import { z } from 'incur';
import { toChecksum } from '../commands/_common.js';
import { registryAbi } from '../contracts/abis.js';
import {
  ABSTRACT_MAINNET_ADDRESSES,
  ABSTRACT_MAINNET_DEPLOYMENT_BLOCKS,
} from '../contracts/addresses.js';
import type { createAssemblyPublicClient } from '../contracts/client.js';

type AssemblyClient = ReturnType<typeof createAssemblyPublicClient>;

const DEFAULT_MEMBER_SNAPSHOT_URL = 'https://www.theaiassembly.org/api/indexer/members';
const REGISTERED_EVENT_SCAN_STEP = 100_000n;
const REGISTERED_EVENT_SCAN_TIMEOUT_MS = 20_000;

export type MemberIdentity = { address: string; ens?: string; name?: string };

export type MemberOnchainState = {
  address: string;
  active: boolean;
  registered: boolean;
  activeUntil: bigint;
  lastHeartbeatAt: bigint;
};

const memberSnapshotEntrySchema = z.union([
  z.string(),
  z.object({
    address: z.string(),
    ens: z.string().optional(),
    name: z.string().optional(),
  }),
]);
const memberSnapshotSchema = z.array(memberSnapshotEntrySchema);

export class AssemblyApiValidationError extends Error {
  constructor(
    public readonly details: {
      code: 'INVALID_ASSEMBLY_API_RESPONSE';
      url: string;
      issues: z.ZodIssue[];
      response: unknown;
    },
  ) {
    super('Assembly API response validation failed');
    this.name = 'AssemblyApiValidationError';
  }
}

export class AssemblyIndexerUnavailableError extends Error {
  constructor(
    public readonly details: {
      code: 'ASSEMBLY_INDEXER_UNAVAILABLE';
      url: string;
      reason?: string;
      status?: number;
      statusText?: string;
    },
  ) {
    super('Assembly indexer unavailable');
    this.name = 'AssemblyIndexerUnavailableError';
  }
}

function memberSnapshotEntryToIdentity(
  entry: z.infer<typeof memberSnapshotEntrySchema>,
): MemberIdentity {
  if (typeof entry === 'string') return { address: entry };
  const identity: MemberIdentity = { address: entry.address };
  if (entry.ens !== undefined) identity.ens = entry.ens;
  if (entry.name !== undefined) identity.name = entry.name;
  return identity;
}

function mergeMemberIdentities(entries: MemberIdentity[]): MemberIdentity[] {
  const byAddress = new Map<string, MemberIdentity>();
  for (const entry of entries) {
    const key = entry.address.toLowerCase();
    const existing = byAddress.get(key);
    if (!existing) {
      byAddress.set(key, entry);
      continue;
    }
    const merged: MemberIdentity = { address: existing.address };
    const ens = existing.ens ?? entry.ens;
    const name = existing.name ?? entry.name;
    if (ens !== undefined) merged.ens = ens;
    if (name !== undefined) merged.name = name;
    byAddress.set(key, merged);
  }
  return [...byAddress.values()];
}

async function memberSnapshot(url: string): Promise<MemberIdentity[]> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (error) {
    throw new AssemblyIndexerUnavailableError({
      code: 'ASSEMBLY_INDEXER_UNAVAILABLE',
      url,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  if (!res.ok) {
    throw new AssemblyIndexerUnavailableError({
      code: 'ASSEMBLY_INDEXER_UNAVAILABLE',
      url,
      status: res.status,
      statusText: res.statusText,
    });
  }

  const json = (await res.json()) as unknown;
  const parsed = memberSnapshotSchema.safeParse(json);
  if (parsed.success) {
    return mergeMemberIdentities(parsed.data.map(memberSnapshotEntryToIdentity));
  }

  throw new AssemblyApiValidationError({
    code: 'INVALID_ASSEMBLY_API_RESPONSE',
    url,
    issues: parsed.error.issues,
    response: json,
  });
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function membersFromRegisteredEvents(client: AssemblyClient): Promise<MemberIdentity[]> {
  const latestBlock = await client.getBlockNumber();
  const addresses = new Set<string>();

  for (
    let fromBlock = ABSTRACT_MAINNET_DEPLOYMENT_BLOCKS.registry;
    fromBlock <= latestBlock;
    fromBlock += REGISTERED_EVENT_SCAN_STEP
  ) {
    const toBlock =
      fromBlock + REGISTERED_EVENT_SCAN_STEP - 1n > latestBlock
        ? latestBlock
        : fromBlock + REGISTERED_EVENT_SCAN_STEP - 1n;
    const events = (await client.getContractEvents({
      abi: registryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.registry,
      eventName: 'Registered',
      fromBlock,
      toBlock,
      strict: true,
    })) as Array<{ args: { member?: string } }>;

    for (const event of events) {
      const member = event.args.member;
      if (typeof member === 'string') {
        addresses.add(member);
      }
    }
  }

  return [...addresses].map((address) => ({ address }));
}

export async function fetchMemberList(
  client: AssemblyClient,
  snapshotUrl?: string,
): Promise<{
  members: MemberIdentity[];
  fallbackReason?: AssemblyIndexerUnavailableError['details'];
}> {
  const url = snapshotUrl ?? DEFAULT_MEMBER_SNAPSHOT_URL;
  try {
    return { members: await memberSnapshot(url) };
  } catch (error) {
    if (error instanceof AssemblyApiValidationError) {
      throw error;
    }
    if (!(error instanceof AssemblyIndexerUnavailableError)) {
      throw error;
    }

    const fallbackMembers = await withTimeout(
      membersFromRegisteredEvents(client),
      REGISTERED_EVENT_SCAN_TIMEOUT_MS,
      `Registered event fallback scan timed out after ${REGISTERED_EVENT_SCAN_TIMEOUT_MS}ms`,
    );

    return {
      members: mergeMemberIdentities(fallbackMembers),
      fallbackReason: error.details,
    };
  }
}

export async function fetchMemberOnchainState(
  client: AssemblyClient,
  addresses: string[],
): Promise<MemberOnchainState[]> {
  if (addresses.length === 0) return [];

  const calls = addresses.flatMap((address) => [
    {
      abi: registryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.registry,
      functionName: 'isActive',
      args: [address] as const,
    },
    {
      abi: registryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.registry,
      functionName: 'members',
      args: [address] as const,
    },
  ]);

  const values = await client.multicall({ allowFailure: false, contracts: calls });

  return addresses.map((address, i) => {
    const active = values[i * 2] as boolean;
    const info = values[i * 2 + 1] as {
      registered: boolean;
      activeUntil: bigint;
      lastHeartbeatAt: bigint;
    };
    return {
      address: toChecksum(address),
      active,
      registered: info.registered,
      activeUntil: info.activeUntil,
      lastHeartbeatAt: info.lastHeartbeatAt,
    };
  });
}
