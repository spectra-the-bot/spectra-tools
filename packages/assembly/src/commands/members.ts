import { TxError } from '@spectratools/tx-shared';
import { Cli, z } from 'incur';
import { registryAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import {
  AssemblyApiValidationError,
  type AssemblyIndexerUnavailableError,
  type MemberIdentity,
  fetchMemberList,
  fetchMemberOnchainState,
} from '../services/members.js';
import { asNum, eth, relTime, timeValue, toChecksum } from './_common.js';
import { assemblyWriteTx, writeEnv, writeOptions } from './_write-utils.js';

const DEFAULT_MEMBER_SNAPSHOT_URL = 'https://www.theaiassembly.org/api/indexer/members';
const MAX_MEMBER_LOOKUP_SUGGESTIONS = 5;

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
  ASSEMBLY_INDEXER_URL: z
    .string()
    .optional()
    .describe('Optional members snapshot endpoint (default: theaiassembly.org indexer)'),
});

const timestampOutput = z.union([z.number(), z.string()]);

function matchableAddressInput(query: string): boolean {
  return query.startsWith('0x') && query.length === 42;
}

function searchMemberIdentities(query: string, members: MemberIdentity[]): MemberIdentity[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];

  const exactMatches = members.filter((member) => {
    return (
      member.address.toLowerCase() === needle ||
      member.ens?.toLowerCase() === needle ||
      member.name?.toLowerCase() === needle
    );
  });
  if (exactMatches.length > 0) return exactMatches;

  return members.filter((member) => {
    return (
      member.address.toLowerCase().includes(needle) ||
      member.ens?.toLowerCase().includes(needle) ||
      member.name?.toLowerCase().includes(needle)
    );
  });
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

function describeMember(member: MemberIdentity): string {
  const parts = [toChecksum(member.address)];
  if (member.ens) parts.push(`ens=${member.ens}`);
  if (member.name) parts.push(`name=${member.name}`);
  return parts.join(' ');
}

export const members = Cli.create('members', {
  description: 'Inspect Assembly membership and registry fee state.',
});

members.command('list', {
  description:
    'List members from an indexer snapshot (or Registered event fallback) plus on-chain active state.',
  env,
  output: z.object({
    members: z.array(
      z.object({
        address: z.string(),
        active: z.boolean(),
        registered: z.boolean(),
        activeUntil: timestampOutput,
        activeUntilRelative: z.string(),
        lastHeartbeatAt: timestampOutput,
        lastHeartbeatRelative: z.string(),
      }),
    ),
    count: z.number(),
  }),
  examples: [
    { description: 'List members using default indexer snapshot' },
    { description: 'Override ASSEMBLY_INDEXER_URL to use a custom snapshot source' },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const snapshotUrl = c.env.ASSEMBLY_INDEXER_URL ?? DEFAULT_MEMBER_SNAPSHOT_URL;

    let memberIdentities: MemberIdentity[];
    let fallbackReason: AssemblyIndexerUnavailableError['details'] | undefined;
    try {
      const loaded = await fetchMemberList(client, snapshotUrl);
      memberIdentities = loaded.members;
      fallbackReason = loaded.fallbackReason;
    } catch (error) {
      if (error instanceof AssemblyApiValidationError) {
        return c.error({
          code: error.details.code,
          message: `Member snapshot response failed validation. url=${error.details.url}; issues=${JSON.stringify(error.details.issues)}; response=${JSON.stringify(error.details.response)}`,
          retryable: false,
        });
      }
      if (!(error instanceof Error)) {
        throw error;
      }

      return c.error({
        code: 'MEMBER_LIST_SOURCE_UNAVAILABLE',
        message: `Unable to load member list from indexer (${snapshotUrl}) or on-chain fallback: ${error.message}`,
        retryable: true,
      });
    }

    if (fallbackReason) {
      emitIndexerFallbackWarning(fallbackReason);
    }

    const addresses = memberIdentities.map((member) => member.address);
    const onchainStates = await fetchMemberOnchainState(client, addresses);
    const rows = onchainStates.map((state) => ({
      address: state.address,
      active: state.active,
      registered: state.registered,
      activeUntil: timeValue(state.activeUntil, c.format),
      activeUntilRelative: relTime(state.activeUntil),
      lastHeartbeatAt: timeValue(state.lastHeartbeatAt, c.format),
      lastHeartbeatRelative: relTime(state.lastHeartbeatAt),
    }));
    return c.ok({
      members: rows,
      count: rows.length,
    });
  },
});

members.command('info', {
  description:
    'Get member registry record and active status by full address, partial address, ENS, or name.',
  args: z.object({
    address: z
      .string()
      .describe('Member lookup query (full/partial address, ENS, or name metadata)'),
  }),
  env,
  output: z.object({
    address: z.string(),
    active: z.boolean(),
    activeUntil: timestampOutput,
    lastHeartbeatAt: timestampOutput,
    activeUntilRelative: z.string(),
    lastHeartbeatRelative: z.string(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      description: 'Inspect one member address',
    },
    {
      args: { address: 'a96045' },
      description: 'Lookup a member by partial address',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const snapshotUrl = c.env.ASSEMBLY_INDEXER_URL ?? DEFAULT_MEMBER_SNAPSHOT_URL;

    let lookupAddress = c.args.address;
    if (!matchableAddressInput(c.args.address)) {
      let loadedMembers: MemberIdentity[];
      let fallbackReason: AssemblyIndexerUnavailableError['details'] | undefined;
      try {
        const loaded = await fetchMemberList(client, snapshotUrl);
        loadedMembers = loaded.members;
        fallbackReason = loaded.fallbackReason;
      } catch (error) {
        if (error instanceof AssemblyApiValidationError) {
          return c.error({
            code: error.details.code,
            message: `Member snapshot response failed validation. url=${error.details.url}; issues=${JSON.stringify(error.details.issues)}; response=${JSON.stringify(error.details.response)}`,
            retryable: false,
          });
        }
        return c.error({
          code: 'MEMBER_LOOKUP_SOURCE_UNAVAILABLE',
          message:
            error instanceof Error
              ? `Unable to resolve member query from indexer (${snapshotUrl}) or on-chain fallback: ${error.message}`
              : `Unable to resolve member query from indexer (${snapshotUrl}) or on-chain fallback.`,
          retryable: true,
        });
      }

      if (fallbackReason) {
        emitIndexerFallbackWarning(fallbackReason);
      }

      const matches = searchMemberIdentities(c.args.address, loadedMembers);
      if (matches.length === 0) {
        return c.error({
          code: 'MEMBER_NOT_FOUND',
          message: `No Assembly member matched "${c.args.address}". Try a longer query or run \`assembly members list\` first.`,
          retryable: false,
        });
      }

      if (matches.length > 1) {
        const suggestions = matches
          .slice(0, MAX_MEMBER_LOOKUP_SUGGESTIONS)
          .map(describeMember)
          .join('; ');
        return c.error({
          code: 'AMBIGUOUS_MEMBER_QUERY',
          message: `Member query "${c.args.address}" matched ${matches.length} members. Be more specific. Matches: ${suggestions}`,
          retryable: false,
        });
      }

      lookupAddress = matches[0].address;
    }

    const [member, active] = (await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'members',
        args: [lookupAddress],
      }),
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'isActive',
        args: [lookupAddress],
      }),
    ])) as [{ activeUntil: bigint; lastHeartbeatAt: bigint }, boolean];
    return c.ok({
      address: toChecksum(lookupAddress),
      active,
      activeUntil: timeValue(member.activeUntil, c.format),
      lastHeartbeatAt: timeValue(member.lastHeartbeatAt, c.format),
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

// ---------------------------------------------------------------------------
// Write commands
// ---------------------------------------------------------------------------

const txOutputSchema = z.union([
  z.object({
    status: z.enum(['success', 'reverted']),
    hash: z.string(),
    blockNumber: z.number(),
    gasUsed: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    effectiveGasPrice: z.string().optional(),
    fee: z.string(),
    feeEth: z.string(),
  }),
  z.object({
    status: z.literal('dry-run'),
    estimatedGas: z.string(),
    simulationResult: z.unknown(),
    fee: z.string(),
    feeEth: z.string(),
  }),
]);

members.command('register', {
  description: 'Register as a new Assembly member (pays the registration fee).',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  env: writeEnv,
  options: writeOptions,
  output: txOutputSchema,
  examples: [
    { description: 'Register as a member' },
    { options: { 'dry-run': true }, description: 'Simulate registration without broadcasting' },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const fee = (await client.readContract({
      abi: registryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.registry,
      functionName: 'registrationFee',
    })) as bigint;

    process.stderr.write(
      `${JSON.stringify({ level: 'info', message: `Registration fee: ${eth(fee)} (${fee} wei)` })}\n`,
    );

    try {
      const result = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        abi: registryAbi,
        functionName: 'register',
        value: fee,
      });

      return c.ok(
        { ...result, fee: fee.toString(), feeEth: eth(fee) },
        result.status === 'success'
          ? {
              cta: {
                description: 'Check your membership:',
                commands: [{ command: 'members info', args: { address: result.from } }],
              },
            }
          : undefined,
      );
    } catch (error) {
      if (error instanceof TxError && error.code === 'INSUFFICIENT_FUNDS') {
        return c.error({
          code: 'INSUFFICIENT_FUNDS',
          message: `Insufficient funds to register. Required fee: ${eth(fee)} (${fee} wei). ${error.message}`,
          retryable: false,
        });
      }
      throw error;
    }
  },
});

members.command('heartbeat', {
  description: 'Send a heartbeat to extend active membership (pays the heartbeat fee).',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  env: writeEnv,
  options: writeOptions,
  output: txOutputSchema,
  examples: [
    { description: 'Send a heartbeat' },
    { options: { 'dry-run': true }, description: 'Simulate heartbeat without broadcasting' },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const fee = (await client.readContract({
      abi: registryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.registry,
      functionName: 'heartbeatFee',
    })) as bigint;

    process.stderr.write(
      `${JSON.stringify({ level: 'info', message: `Heartbeat fee: ${eth(fee)} (${fee} wei)` })}\n`,
    );

    try {
      const result = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        abi: registryAbi,
        functionName: 'heartbeat',
        value: fee,
      });

      return c.ok(
        { ...result, fee: fee.toString(), feeEth: eth(fee) },
        result.status === 'success'
          ? {
              cta: {
                description: 'Check your membership:',
                commands: [{ command: 'members info', args: { address: result.from } }],
              },
            }
          : undefined,
      );
    } catch (error) {
      if (error instanceof TxError && error.code === 'INSUFFICIENT_FUNDS') {
        return c.error({
          code: 'INSUFFICIENT_FUNDS',
          message: `Insufficient funds for heartbeat. Required fee: ${eth(fee)} (${fee} wei). ${error.message}`,
          retryable: false,
        });
      }
      throw error;
    }
  },
});

members.command('renew', {
  description: 'Renew an expired membership (pays the registration fee).',
  hint: 'Requires PRIVATE_KEY environment variable for signing. Calls register() to re-activate expired membership.',
  env: writeEnv,
  options: writeOptions,
  output: txOutputSchema,
  examples: [
    { description: 'Renew expired membership' },
    { options: { 'dry-run': true }, description: 'Simulate renewal without broadcasting' },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const fee = (await client.readContract({
      abi: registryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.registry,
      functionName: 'registrationFee',
    })) as bigint;

    process.stderr.write(
      `${JSON.stringify({ level: 'info', message: `Renewal fee: ${eth(fee)} (${fee} wei)` })}\n`,
    );

    try {
      const result = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        abi: registryAbi,
        functionName: 'register',
        value: fee,
      });

      return c.ok(
        { ...result, fee: fee.toString(), feeEth: eth(fee) },
        result.status === 'success'
          ? {
              cta: {
                description: 'Check your membership:',
                commands: [{ command: 'members info', args: { address: result.from } }],
              },
            }
          : undefined,
      );
    } catch (error) {
      if (error instanceof TxError && error.code === 'INSUFFICIENT_FUNDS') {
        return c.error({
          code: 'INSUFFICIENT_FUNDS',
          message: `Insufficient funds to renew. Required fee: ${eth(fee)} (${fee} wei). ${error.message}`,
          retryable: false,
        });
      }
      throw error;
    }
  },
});
