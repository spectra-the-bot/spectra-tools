import { Cli, z } from 'incur';
import { registryAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, eth, relTime, toChecksum } from './_common.js';

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

async function memberSnapshot(url: string): Promise<string[]> {
  const res = await fetch(url);
  if (!res.ok) return [];
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

export const members = Cli.create('members', {
  description: 'Inspect Assembly membership and registry fee state.',
});

members.command('list', {
  description: 'List members from an indexer snapshot plus on-chain active state.',
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
    const snapshotUrl =
      c.env.ASSEMBLY_INDEXER_URL ?? 'https://www.theaiassembly.org/api/indexer/members';

    let addresses: string[];
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
      throw error;
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
        description: 'Inspect one member:',
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
