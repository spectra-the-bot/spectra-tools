import { Cli, z } from 'incur';
import { governanceAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, relTime, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

export const governance = Cli.create('governance', {
  description: 'Inspect Assembly governance proposals, votes, and parameters.',
});

governance.command('proposals', {
  description: 'List governance proposals with status and vote end time.',
  env,
  output: z.array(
    z.object({
      id: z.number(),
      kind: z.number(),
      status: z.number(),
      title: z.string().nullable().optional(),
      voteEndAt: z.number(),
      voteEndRelative: z.string(),
    }),
  ),
  examples: [{ description: 'List all proposals' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposalCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const proposals = (
      ids.length
        ? await client.multicall({
            allowFailure: false,
            contracts: ids.map((id) => ({
              abi: governanceAbi,
              address: ABSTRACT_MAINNET_ADDRESSES.governance,
              functionName: 'proposals',
              args: [id] as const,
            })),
          })
        : []
    ) as Array<Record<string, unknown>>;
    return c.ok(
      proposals.map((p, i: number) => ({
        id: i + 1,
        kind: asNum(p.kind as bigint),
        status: asNum(p.status as bigint),
        title: (p.title as string | undefined) ?? null,
        voteEndAt: asNum(p.voteEndAt as bigint),
        voteEndRelative: relTime(p.voteEndAt as bigint),
      })),
      {
        cta: {
          description: 'Inspect or vote:',
          commands: [
            { command: 'governance proposal', args: { id: '<id>' } },
            { command: 'governance vote', args: { id: '<id>' } },
          ],
        },
      },
    );
  },
});

governance.command('proposal', {
  description: 'Get full raw proposal details by proposal id.',
  args: z.object({
    id: z.coerce.number().int().positive().describe('Proposal id (1-indexed)'),
  }),
  env,
  output: z.record(z.string(), z.unknown()),
  examples: [{ args: { id: 1 }, description: 'Fetch proposal #1' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const proposal = (await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposals',
      args: [BigInt(c.args.id)],
    })) as Record<string, unknown>;
    return c.ok(proposal);
  },
});

governance.command('has-voted', {
  description: 'Check if an address has voted on a proposal.',
  args: z.object({
    proposalId: z.coerce.number().int().positive().describe('Proposal id (1-indexed)'),
    address: z.string().describe('Voter address'),
  }),
  env,
  output: z.object({
    proposalId: z.number(),
    address: z.string(),
    hasVoted: z.boolean(),
  }),
  examples: [
    {
      args: {
        proposalId: 1,
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      },
      description: 'Check whether an address already voted',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const hasVoted = (await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'hasVoted',
      args: [BigInt(c.args.proposalId), c.args.address],
    })) as boolean;
    return c.ok({
      proposalId: c.args.proposalId,
      address: toChecksum(c.args.address),
      hasVoted,
    });
  },
});

governance.command('params', {
  description: 'Read governance threshold and timing parameters.',
  env,
  output: z.object({
    deliberationPeriod: z.number(),
    votePeriod: z.number(),
    quorumBps: z.number(),
    constitutionalDeliberationPeriod: z.number(),
    constitutionalVotePeriod: z.number(),
    constitutionalPassBps: z.number(),
    majorPassBps: z.number(),
    parameterPassBps: z.number(),
    significantPassBps: z.number(),
    significantThresholdBps: z.number(),
    routineThresholdBps: z.number(),
    timelockPeriod: z.number(),
  }),
  examples: [{ description: 'Inspect governance timing and pass thresholds' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const getters = [
      'deliberationPeriod',
      'votePeriod',
      'quorumBps',
      'constitutionalDeliberationPeriod',
      'constitutionalVotePeriod',
      'constitutionalPassBps',
      'majorPassBps',
      'parameterPassBps',
      'significantPassBps',
      'significantThresholdBps',
      'routineThresholdBps',
      'timelockPeriod',
    ] as const;
    const values = await client.multicall({
      allowFailure: false,
      contracts: getters.map((name) => ({
        abi: governanceAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.governance,
        functionName: name,
      })),
    });
    return c.ok({
      deliberationPeriod: asNum(values[0] as bigint),
      votePeriod: asNum(values[1] as bigint),
      quorumBps: asNum(values[2] as bigint),
      constitutionalDeliberationPeriod: asNum(values[3] as bigint),
      constitutionalVotePeriod: asNum(values[4] as bigint),
      constitutionalPassBps: asNum(values[5] as bigint),
      majorPassBps: asNum(values[6] as bigint),
      parameterPassBps: asNum(values[7] as bigint),
      significantPassBps: asNum(values[8] as bigint),
      significantThresholdBps: asNum(values[9] as bigint),
      routineThresholdBps: asNum(values[10] as bigint),
      timelockPeriod: asNum(values[11] as bigint),
    });
  },
});
