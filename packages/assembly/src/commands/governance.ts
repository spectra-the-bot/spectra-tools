import { TxError } from '@spectratools/tx-shared';
import { Cli, z } from 'incur';
import { councilSeatsAbi, forumAbi, governanceAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, relTime, timeValue, toChecksum } from './_common.js';
import {
  type FormattedDryRunResult,
  type FormattedTxResult,
  assemblyWriteTx,
  resolveAccount,
  writeEnv,
  writeOptions,
} from './_write-utils.js';

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

const PROPOSAL_STATUS_PENDING = 0;
const PROPOSAL_STATUS_ACTIVE = 1;
const PROPOSAL_STATUS_PASSED = 2;

const supportChoiceToValue = {
  against: 0,
  for: 1,
  abstain: 2,
} as const;

type SupportChoice = keyof typeof supportChoiceToValue;

type AssemblyClient = ReturnType<typeof createAssemblyPublicClient>;

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

async function readProposalCount(client: AssemblyClient): Promise<bigint> {
  return (await client.readContract({
    abi: governanceAbi,
    address: ABSTRACT_MAINNET_ADDRESSES.governance,
    functionName: 'proposalCount',
  })) as bigint;
}

async function readProposalById(
  client: AssemblyClient,
  proposalId: number,
): Promise<DecodedProposal> {
  return decodeProposal(
    await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposals',
      args: [BigInt(proposalId)],
    }),
  );
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
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Inspect or vote:',
              commands: [
                { command: 'governance proposal', args: { id: '<id>' } },
                {
                  command: 'governance vote',
                  args: { proposalId: '<id>', support: '<for|against|abstain>' },
                },
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

// ---------------------------------------------------------------------------
// Write commands
// ---------------------------------------------------------------------------

const txResultOutput = z.union([
  z.object({
    status: z.enum(['success', 'reverted']),
    hash: z.string(),
    blockNumber: z.number(),
    gasUsed: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    effectiveGasPrice: z.string().optional(),
  }),
  z.object({
    status: z.literal('dry-run'),
    estimatedGas: z.string(),
    simulationResult: z.unknown(),
  }),
]);

governance.command('vote', {
  description: 'Cast a governance vote on a proposal.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  args: z.object({
    proposalId: z.coerce.number().int().positive().describe('Proposal id (1-indexed)'),
    support: z
      .enum(['for', 'against', 'abstain'])
      .describe('Vote support: for, against, or abstain'),
  }),
  options: writeOptions,
  env: writeEnv,
  output: z.object({
    proposalId: z.number(),
    proposalTitle: z.string(),
    support: z.enum(['for', 'against', 'abstain']),
    supportValue: z.number(),
    tx: txResultOutput,
  }),
  examples: [
    {
      args: { proposalId: 1, support: 'for' },
      description: 'Vote in favor of proposal #1',
    },
    {
      args: { proposalId: 1, support: 'abstain' },
      options: { 'dry-run': true },
      description: 'Simulate casting an abstain vote',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const account = resolveAccount(c.env);

    const proposalCount = await readProposalCount(client);
    if (c.args.proposalId > Number(proposalCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Proposal id ${c.args.proposalId} does not exist (proposalCount: ${proposalCount})`,
        retryable: false,
      });
    }

    const proposal = await readProposalById(client, c.args.proposalId);
    const status = proposalStatus(proposal.status);
    if (status.statusCode !== PROPOSAL_STATUS_ACTIVE) {
      return c.error({
        code: 'PROPOSAL_NOT_VOTING',
        message: `Proposal ${c.args.proposalId} is ${status.status} and cannot be voted right now.`,
        retryable: false,
      });
    }

    const hasVoted = (await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'hasVoted',
      args: [BigInt(c.args.proposalId), account.address],
    })) as boolean;
    if (hasVoted) {
      return c.error({
        code: 'ALREADY_VOTED',
        message: `Address ${toChecksum(account.address)} has already voted on proposal ${c.args.proposalId}.`,
        retryable: false,
      });
    }

    const supportValue = supportChoiceToValue[c.args.support as SupportChoice];

    try {
      const txResult = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.governance,
        abi: governanceAbi,
        functionName: 'castVote',
        args: [BigInt(c.args.proposalId), supportValue],
      });

      return c.ok({
        proposalId: c.args.proposalId,
        proposalTitle: proposal.title,
        support: c.args.support,
        supportValue,
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      });
    } catch (error) {
      if (error instanceof TxError) {
        return c.error({
          code: error.code,
          message: error.message,
          retryable: error.code === 'NONCE_CONFLICT',
        });
      }
      throw error;
    }
  },
});

governance.command('propose', {
  description: 'Create a new council-originated governance proposal.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  options: writeOptions.extend({
    title: z.string().min(1).describe('Proposal title'),
    description: z.string().min(1).describe('Proposal description'),
    kind: z.coerce.number().int().nonnegative().max(255).describe('Proposal kind enum value'),
    category: z.string().default('governance').describe('Forum category label for the proposal'),
    'risk-tier': z.coerce
      .number()
      .int()
      .nonnegative()
      .max(255)
      .optional()
      .describe('Optional max allowed intent risk tier (default: 0)'),
    amount: z
      .string()
      .optional()
      .describe('Optional treasury amount hint (currently unsupported for intent encoding)'),
    recipient: z
      .string()
      .optional()
      .describe('Optional treasury recipient hint (currently unsupported for intent encoding)'),
  }),
  env: writeEnv,
  output: z.object({
    proposer: z.string(),
    category: z.string(),
    kind: z.number(),
    title: z.string(),
    description: z.string(),
    expectedProposalId: z.number(),
    tx: txResultOutput,
  }),
  examples: [
    {
      options: {
        title: 'Increase quorum requirement',
        description: 'Raise quorum from 10% to 12% for governance votes.',
        kind: 3,
      },
      description: 'Create a governance proposal from a council member account',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const account = resolveAccount(c.env);

    if ((c.options.amount && !c.options.recipient) || (!c.options.amount && c.options.recipient)) {
      return c.error({
        code: 'INVALID_PROPOSAL_OPTIONS',
        message:
          'Both --amount and --recipient must be provided together when setting transfer hints.',
        retryable: false,
      });
    }

    if (c.options.amount || c.options.recipient) {
      return c.error({
        code: 'UNSUPPORTED_TRANSFER_INTENT',
        message:
          'Transfer intents are not yet supported by `governance propose`. Omit --amount/--recipient and use intent-specific tooling.',
        retryable: false,
      });
    }

    const isCouncilMember = (await client.readContract({
      abi: councilSeatsAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
      functionName: 'isCouncilMember',
      args: [account.address],
    })) as boolean;

    if (!isCouncilMember) {
      return c.error({
        code: 'NOT_COUNCIL_MEMBER',
        message: `Address ${toChecksum(account.address)} is not an active council member and cannot create a council proposal.`,
        retryable: false,
      });
    }

    const proposalCountBefore = await readProposalCount(client);
    const expectedProposalId = Number(proposalCountBefore) + 1;

    const proposalInput = {
      kind: c.options.kind,
      title: c.options.title,
      description: c.options.description,
      intentSteps: [],
      intentConstraints: {
        deadline: 0,
        maxAllowedRiskTier: c.options['risk-tier'] ?? 0,
      },
      configUpdates: [],
    };

    try {
      const txResult = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        abi: forumAbi,
        functionName: 'createCouncilProposal',
        args: [c.options.category, proposalInput],
      });

      return c.ok({
        proposer: toChecksum(account.address),
        category: c.options.category,
        kind: c.options.kind,
        title: c.options.title,
        description: c.options.description,
        expectedProposalId,
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      });
    } catch (error) {
      if (error instanceof TxError) {
        return c.error({
          code: error.code,
          message: error.message,
          retryable: error.code === 'NONCE_CONFLICT',
        });
      }
      throw error;
    }
  },
});

governance.command('queue', {
  description: 'Finalize voting and queue an eligible proposal into timelock.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  args: z.object({
    proposalId: z.coerce.number().int().positive().describe('Proposal id (1-indexed)'),
  }),
  options: writeOptions,
  env: writeEnv,
  output: z.object({
    proposalId: z.number(),
    proposalTitle: z.string(),
    statusBefore: z.string(),
    tx: txResultOutput,
  }),
  examples: [
    {
      args: { proposalId: 1 },
      description: 'Finalize voting for proposal #1 and queue if passed',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);

    const proposalCount = await readProposalCount(client);
    if (c.args.proposalId > Number(proposalCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Proposal id ${c.args.proposalId} does not exist (proposalCount: ${proposalCount})`,
        retryable: false,
      });
    }

    const proposal = await readProposalById(client, c.args.proposalId);
    const status = proposalStatus(proposal.status);

    if (status.statusCode === PROPOSAL_STATUS_PASSED) {
      return c.error({
        code: 'ALREADY_QUEUED',
        message: `Proposal ${c.args.proposalId} is already queued in timelock.`,
        retryable: false,
      });
    }

    if (status.statusCode === PROPOSAL_STATUS_PENDING) {
      return c.error({
        code: 'PROPOSAL_NOT_QUEUEABLE',
        message: `Proposal ${c.args.proposalId} is still in deliberation and cannot be queued yet.`,
        retryable: false,
      });
    }

    if (status.statusCode !== PROPOSAL_STATUS_ACTIVE) {
      return c.error({
        code: 'PROPOSAL_NOT_QUEUEABLE',
        message: `Proposal ${c.args.proposalId} is ${status.status} and cannot be queued.`,
        retryable: false,
      });
    }

    const latestBlock = (await client.getBlock({ blockTag: 'latest' })) as { timestamp: bigint };
    if (latestBlock.timestamp < proposal.voteEndAt) {
      return c.error({
        code: 'VOTING_STILL_ACTIVE',
        message: `Proposal ${c.args.proposalId} voting window is still open (ends ${relTime(proposal.voteEndAt)}).`,
        retryable: false,
      });
    }

    try {
      const txResult = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.governance,
        abi: governanceAbi,
        functionName: 'finalizeVote',
        args: [BigInt(c.args.proposalId)],
      });

      return c.ok({
        proposalId: c.args.proposalId,
        proposalTitle: proposal.title,
        statusBefore: status.status,
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      });
    } catch (error) {
      if (error instanceof TxError) {
        return c.error({
          code: error.code,
          message: error.message,
          retryable: error.code === 'NONCE_CONFLICT',
        });
      }
      throw error;
    }
  },
});

governance.command('execute', {
  description: 'Execute a queued governance proposal after timelock expiry.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  args: z.object({
    proposalId: z.coerce.number().int().positive().describe('Proposal id (1-indexed)'),
  }),
  options: writeOptions,
  env: writeEnv,
  output: z.object({
    proposalId: z.number(),
    proposalTitle: z.string(),
    timelockEndsAt: timestampOutput,
    tx: txResultOutput,
  }),
  examples: [
    {
      args: { proposalId: 1 },
      description: 'Execute proposal #1 after timelock has expired',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);

    const proposalCount = await readProposalCount(client);
    if (c.args.proposalId > Number(proposalCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Proposal id ${c.args.proposalId} does not exist (proposalCount: ${proposalCount})`,
        retryable: false,
      });
    }

    const proposal = await readProposalById(client, c.args.proposalId);
    const status = proposalStatus(proposal.status);
    if (status.statusCode !== PROPOSAL_STATUS_PASSED) {
      return c.error({
        code: 'PROPOSAL_NOT_EXECUTABLE',
        message: `Proposal ${c.args.proposalId} is ${status.status} and cannot be executed.`,
        retryable: false,
      });
    }

    const latestBlock = (await client.getBlock({ blockTag: 'latest' })) as { timestamp: bigint };
    if (latestBlock.timestamp < proposal.timelockEndsAt) {
      return c.error({
        code: 'TIMELOCK_ACTIVE',
        message: `Proposal ${c.args.proposalId} timelock has not expired yet (ends ${relTime(proposal.timelockEndsAt)}).`,
        retryable: false,
      });
    }

    try {
      const txResult = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.governance,
        abi: governanceAbi,
        functionName: 'executeProposal',
        args: [BigInt(c.args.proposalId)],
      });

      return c.ok({
        proposalId: c.args.proposalId,
        proposalTitle: proposal.title,
        timelockEndsAt: timeValue(proposal.timelockEndsAt, c.format),
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      });
    } catch (error) {
      if (error instanceof TxError) {
        return c.error({
          code: error.code,
          message: error.message,
          retryable: error.code === 'NONCE_CONFLICT',
        });
      }
      throw error;
    }
  },
});
