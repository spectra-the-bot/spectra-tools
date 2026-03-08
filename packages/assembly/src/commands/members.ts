import { Cli, z } from 'incur';
import { registryAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, eth, relTime, toChecksum } from './_common.js';

const DEFAULT_MEMBER_SNAPSHOT_URL = 'https://www.theaiassembly.org/api/indexer/members';
const REGISTERED_EVENT_SCAN_STEP = 100_000n;

type AssemblyClient = ReturnType<typeof createAssemblyPublicClient>;

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
  ASSEMBLY_INDEXER_URL: z
    .string()
    .optional()
    .describe('Optional members snapshot endpoint (default: theaiassembly.org indexer)'),
});

const memberSnapshotSchema = z.array(z.string());

class AssemblyApiValidationError extends Error {
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

class AssemblyIndexerUnavailableError extends Error {
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

async function memberSnapshot(url: string): Promise<string[]> {
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
    return parsed.data;
  }

  throw new AssemblyApiValidationError({
    code: 'INVALID_ASSEMBLY_API_RESPONSE',
    url,
    issues: parsed.error.issues,
    response: json,
  });
}

async function membersFromRegisteredEvents(client: AssemblyClient): Promise<string[]> {
  const latestBlock = await client.getBlockNumber();
  const addresses = new Set<string>();

  for (let fromBlock = 0n; fromBlock <= latestBlock; fromBlock += REGISTERED_EVENT_SCAN_STEP) {
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

  return [...addresses];
}

function indexerIssue(details: AssemblyIndexerUnavailableError['details']): string {
  if (typeof details.status === 'number') {
    return `${details.status}${details.statusText ? ` ${details.statusText}` : ''}`;
  }
  if (details.reason) return details.reason;
  return 'unknown error';
}

function emitIndexerFallbackWarning(details: AssemblyIndexerUnavailableError['details']) {
  process.stderr.write(
    `${JSON.stringify({
      level: 'warn',
      code: details.code,
      message:
        'Member snapshot indexer is unavailable. Falling back to on-chain Registered events.',
      url: details.url,
      issue: indexerIssue(details),
    })}\n`,
  );
}

export const members = Cli.create('members', {
  description: 'Inspect Assembly membership and registry fee state.',
});

members.command('list', {
  description:
    'List members from an indexer snapshot (or Registered event fallback) plus on-chain active state.',
  env,
  output: z.array(
    z.object({
      address: z.string(),
      active: z.boolean(),
      registered: z.boolean(),
      activeUntil: z.number(),
      activeUntilRelative: z.string(),
      lastHeartbeatAt: z.number(),
      lastHeartbeatRelative: z.string(),
    }),
  ),
  examples: [
    { description: 'List members using default indexer snapshot' },
    { description: 'Override ASSEMBLY_INDEXER_URL to use a custom snapshot source' },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const snapshotUrl = c.env.ASSEMBLY_INDEXER_URL ?? DEFAULT_MEMBER_SNAPSHOT_URL;

    let addresses: string[];
    let fallbackReason: AssemblyIndexerUnavailableError['details'] | undefined;
    try {
      addresses = await memberSnapshot(snapshotUrl);
    } catch (error) {
      if (error instanceof AssemblyApiValidationError) {
        return c.error({
          code: error.details.code,
          message: `Member snapshot response failed validation. url=${error.details.url}; issues=${JSON.stringify(error.details.issues)}; response=${JSON.stringify(error.details.response)}`,
          retryable: false,
        });
      }
      if (!(error instanceof AssemblyIndexerUnavailableError)) {
        throw error;
      }

      fallbackReason = error.details;
      try {
        addresses = await membersFromRegisteredEvents(client);
      } catch (fallbackError) {
        return c.error({
          code: 'MEMBER_LIST_SOURCE_UNAVAILABLE',
          message: `Member indexer unavailable (${indexerIssue(error.details)} at ${error.details.url}) and on-chain Registered event fallback failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`,
          retryable: true,
        });
      }
    }

    if (fallbackReason) {
      emitIndexerFallbackWarning(fallbackReason);
    }

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
    const values =
      calls.length > 0 ? await client.multicall({ allowFailure: false, contracts: calls }) : [];
    const rows = addresses.map((address, i) => {
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
        activeUntil: Number(info.activeUntil),
        activeUntilRelative: relTime(info.activeUntil),
        lastHeartbeatAt: Number(info.lastHeartbeatAt),
        lastHeartbeatRelative: relTime(info.lastHeartbeatAt),
      };
    });
    return c.ok(rows, {
      cta: {
        description: fallbackReason
          ? `Indexer unavailable (${indexerIssue(fallbackReason)}); using on-chain Registered event fallback. Inspect one member:`
          : 'Inspect one member:',
        commands: [{ command: 'members info', args: { address: '<addr>' } }],
      },
    });
  },
});

members.command('info', {
  description: 'Get registry record and active status for a member address.',
  args: z.object({
    address: z.string().describe('Member wallet address'),
  }),
  env,
  output: z.object({
    address: z.string(),
    active: z.boolean(),
    activeUntil: z.number(),
    lastHeartbeatAt: z.number(),
    activeUntilRelative: z.string(),
    lastHeartbeatRelative: z.string(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      description: 'Inspect one member address',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [member, active] = (await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'members',
        args: [c.args.address],
      }),
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'isActive',
        args: [c.args.address],
      }),
    ])) as [{ activeUntil: bigint; lastHeartbeatAt: bigint }, boolean];
    return c.ok({
      address: toChecksum(c.args.address),
      active,
      activeUntil: Number(member.activeUntil),
      lastHeartbeatAt: Number(member.lastHeartbeatAt),
      activeUntilRelative: relTime(member.activeUntil),
      lastHeartbeatRelative: relTime(member.lastHeartbeatAt),
    });
  },
});

members.command('count', {
  description: 'Get active and total-known member counts from Registry.',
  env,
  output: z.object({
    active: z.number(),
    total: z.number(),
  }),
  examples: [{ description: 'Count active and known members' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [active, total] = (await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'activeMemberCount',
      }),
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'totalKnownMembers',
      }),
    ])) as [bigint, bigint];
    return c.ok({ active: asNum(active), total: asNum(total) });
  },
});

members.command('fees', {
  description: 'Get registration and heartbeat fee settings.',
  env,
  output: z.object({
    registrationFeeWei: z.string(),
    registrationFee: z.string(),
    heartbeatFeeWei: z.string(),
    heartbeatFee: z.string(),
    heartbeatGracePeriodSeconds: z.number(),
  }),
  examples: [{ description: 'Inspect current registry fee configuration' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [registrationFee, heartbeatFee, heartbeatGracePeriod] = (await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'registrationFee',
      }),
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'heartbeatFee',
      }),
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'heartbeatGracePeriod',
      }),
    ])) as [bigint, bigint, bigint];
    return c.ok({
      registrationFeeWei: registrationFee.toString(),
      registrationFee: eth(registrationFee),
      heartbeatFeeWei: heartbeatFee.toString(),
      heartbeatFee: eth(heartbeatFee),
      heartbeatGracePeriodSeconds: asNum(heartbeatGracePeriod),
    });
  },
});
