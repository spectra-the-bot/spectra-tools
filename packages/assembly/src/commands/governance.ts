import { Cli, z } from 'incur';
import { governanceAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, relTime, timeValue, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

type ProposalTuple = readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  string,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  bigint,
  bigint,
  string,
  string,
];

type DecodedProposal = {
  kind: bigint;
  configRiskTier: bigint;
  origin: bigint;
  status: bigint;
  proposer: string;
  threadId: bigint;
  petitionId: bigint;
  createdAt: bigint;
  deliberationEndsAt: bigint;
  voteStartAt: bigint;
  voteEndAt: bigint;
  timelockEndsAt: bigint;
  activeSeatsSnapshot: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  amount: bigint;
  snapshotAssetBalance: bigint;
  transferIntent: boolean;
  intentDeadline: bigint;
  intentMaxRiskTier: bigint;
  title: string;
  description: string;
};

const timestampOutput = z.union([z.number(), z.string()]);

// Derived from verified Governance.sol source on Abstract mainnet:
// enum ProposalStatus { Deliberation, Voting, Timelock, Executed, Defeated, Cancelled }
const proposalStatusLabels: Record<number, string> = {
  0: 'pending',
  1: 'active',
  2: 'passed',
  3: 'executed',
  4: 'defeated',
  5: 'cancelled',
};

function proposalStatus(status: bigint): { status: string; statusCode: number } {
  const statusCode = asNum(status);
  return {
    status: proposalStatusLabels[statusCode] ?? `unknown-${statusCode}`,
    statusCode,
  };
}

const proposalOutputSchema = z.object({
  kind: z.number(),
  configRiskTier: z.number(),
  origin: z.number(),
  status: z.string(),
  statusCode: z.number(),
  proposer: z.string(),
  threadId: z.number(),
  petitionId: z.number(),
  createdAt: z.number(),
  deliberationEndsAt: z.number(),
  voteStartAt: z.number(),
  voteEndAt: z.number(),
  timelockEndsAt: z.number(),
  activeSeatsSnapshot: z.number(),
  forVotes: z.string(),
  againstVotes: z.string(),
  abstainVotes: z.string(),
  amount: z.string(),
  snapshotAssetBalance: z.string(),
  transferIntent: z.boolean(),
  intentDeadline: z.number(),
  intentMaxRiskTier: z.number(),
  title: z.string(),
  description: z.string(),
});

type ProposalOutput = z.infer<typeof proposalOutputSchema>;

function decodeProposal(value: unknown): DecodedProposal {
  const [
    kind,
    configRiskTier,
    origin,
    status,
    proposer,
    threadId,
    petitionId,
    createdAt,
    deliberationEndsAt,
    voteStartAt,
    voteEndAt,
    timelockEndsAt,
    activeSeatsSnapshot,
    forVotes,
    againstVotes,
    abstainVotes,
    amount,
    snapshotAssetBalance,
    transferIntent,
    intentDeadline,
    intentMaxRiskTier,
    title,
    description,
  ] = value as ProposalTuple;

  return {
    kind,
    configRiskTier,
    origin,
    status,
    proposer: toChecksum(proposer),
    threadId,
    petitionId,
    createdAt,
    deliberationEndsAt,
    voteStartAt,
    voteEndAt,
    timelockEndsAt,
    activeSeatsSnapshot,
    forVotes,
    againstVotes,
    abstainVotes,
    amount,
    snapshotAssetBalance,
    transferIntent,
    intentDeadline,
    intentMaxRiskTier,
    title,
    description,
  };
}

function serializeProposal(proposal: DecodedProposal): ProposalOutput {
  const status = proposalStatus(proposal.status);

  return {
    kind: asNum(proposal.kind),
    configRiskTier: asNum(proposal.configRiskTier),
    origin: asNum(proposal.origin),
    status: status.status,
    statusCode: status.statusCode,
    proposer: proposal.proposer,
    threadId: asNum(proposal.threadId),
    petitionId: asNum(proposal.petitionId),
    createdAt: asNum(proposal.createdAt),
    deliberationEndsAt: asNum(proposal.deliberationEndsAt),
    voteStartAt: asNum(proposal.voteStartAt),
    voteEndAt: asNum(proposal.voteEndAt),
    timelockEndsAt: asNum(proposal.timelockEndsAt),
    activeSeatsSnapshot: asNum(proposal.activeSeatsSnapshot),
    forVotes: proposal.forVotes.toString(),
    againstVotes: proposal.againstVotes.toString(),
    abstainVotes: proposal.abstainVotes.toString(),
    amount: proposal.amount.toString(),
    snapshotAssetBalance: proposal.snapshotAssetBalance.toString(),
    transferIntent: proposal.transferIntent,
    intentDeadline: asNum(proposal.intentDeadline),
    intentMaxRiskTier: asNum(proposal.intentMaxRiskTier),
    title: proposal.title,
    description: proposal.description,
  };
}

export const governance = Cli.create('governance', {
  description: 'Inspect Assembly governance proposals, votes, and parameters.',
});

governance.command('proposals', {
  description: 'List governance proposals with status and vote end time.',
  env,
  output: z.object({
    proposals: z.array(
      z.object({
        id: z.number(),
        kind: z.number(),
        status: z.string(),
        statusCode: z.number(),
        title: z.string().nullable().optional(),
        voteEndAt: timestampOutput,
        voteEndRelative: z.string(),
      }),
    ),
    count: z.number(),
  }),
  examples: [{ description: 'List all proposals' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposalCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const proposalTuples = ids.length
      ? await client.multicall({
          allowFailure: false,
          contracts: ids.map((id) => ({
            abi: governanceAbi,
            address: ABSTRACT_MAINNET_ADDRESSES.governance,
            functionName: 'proposals',
            args: [id] as const,
          })),
        })
      : [];
    const proposals = (proposalTuples as unknown[]).map(decodeProposal);
    const items = proposals.map((p, i: number) => ({
      ...proposalStatus(p.status),
      id: i + 1,
      kind: asNum(p.kind),
      title: p.title ?? null,
      voteEndAt: timeValue(p.voteEndAt, c.format),
      voteEndRelative: relTime(p.voteEndAt),
    }));

    return c.ok(
      {
        proposals: items,
        count: items.length,
      },
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
  output: proposalOutputSchema,
  examples: [{ args: { id: 1 }, description: 'Fetch proposal #1' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const proposalCount = (await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposalCount',
    })) as bigint;

    if (c.args.id > Number(proposalCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Proposal id ${c.args.id} does not exist (proposalCount: ${proposalCount})`,
        retryable: false,
      });
    }

    const proposal = decodeProposal(
      await client.readContract({
        abi: governanceAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.governance,
        functionName: 'proposals',
        args: [BigInt(c.args.id)],
      }),
    );
    return c.ok(serializeProposal(proposal));
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
