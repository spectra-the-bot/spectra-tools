import { TxError } from '@spectratools/tx-shared';
import { Cli, z } from 'incur';
import { type Address, encodeAbiParameters, parseUnits, zeroAddress } from 'viem';
import {
  councilSeatsAbi,
  forumAbi,
  governanceAbi,
  registryAbi,
  treasuryAbi,
} from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, eth, relTime, timeValue, toChecksum } from './_common.js';
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

const timestampOutput = z.union([z.number(), z.string()]);

const txResultOutput = z.union([
  z.object({
    status: z.literal('success'),
    hash: z.string(),
    blockNumber: z.number(),
    gasUsed: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    effectiveGasPrice: z.string().optional(),
  }),
  z.object({
    status: z.literal('reverted'),
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

export const treasury = Cli.create('treasury', {
  description: 'Inspect treasury balances, execution status, and spend controls.',
});

treasury.command('balance', {
  description: 'Get current native token balance for the treasury contract.',
  env,
  output: z.object({
    address: z.string(),
    balanceWei: z.string(),
    balance: z.string(),
  }),
  examples: [{ description: 'Check treasury balance' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const balance = await client.getBalance({ address: ABSTRACT_MAINNET_ADDRESSES.treasury });
    return c.ok({
      address: toChecksum(ABSTRACT_MAINNET_ADDRESSES.treasury),
      balanceWei: balance.toString(),
      balance: eth(balance),
    });
  },
});

treasury.command('whitelist', {
  description: 'Check whether an asset address is treasury-whitelisted.',
  args: z.object({
    asset: z.string().describe('Token/asset contract address'),
  }),
  env,
  output: z.object({
    asset: z.string(),
    whitelisted: z.boolean(),
  }),
  examples: [
    {
      args: { asset: '0x0000000000000000000000000000000000000000' },
      description: 'Check whitelist status for one asset',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const whitelisted = (await client.readContract({
      abi: treasuryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.treasury,
      functionName: 'isAssetWhitelisted',
      args: [c.args.asset],
    })) as boolean;
    return c.ok({ asset: toChecksum(c.args.asset), whitelisted });
  },
});

treasury.command('major-spend-status', {
  description: 'Read major-spend cooldown status for the treasury contract.',
  env,
  output: z.object({
    majorSpendCooldownSeconds: z.number(),
    lastMajorSpendAt: timestampOutput,
    lastMajorSpendRelative: z.string(),
    isMajorSpendAllowed: z.boolean(),
  }),
  examples: [{ description: 'Inspect treasury major-spend guardrails' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [cooldown, lastMajorSpendAt, allowed] = (await Promise.all([
      client.readContract({
        abi: treasuryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.treasury,
        functionName: 'majorSpendCooldown',
      }),
      client.readContract({
        abi: treasuryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.treasury,
        functionName: 'lastMajorSpendAt',
        args: [ABSTRACT_MAINNET_ADDRESSES.treasury],
      }),
      client.readContract({
        abi: treasuryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.treasury,
        functionName: 'isMajorSpendAllowed',
        args: [ABSTRACT_MAINNET_ADDRESSES.treasury, 0n],
      }),
    ])) as [bigint, bigint, boolean];
    return c.ok({
      majorSpendCooldownSeconds: asNum(cooldown),
      lastMajorSpendAt: timeValue(lastMajorSpendAt, c.format),
      lastMajorSpendRelative: relTime(lastMajorSpendAt),
      isMajorSpendAllowed: allowed,
    });
  },
});

treasury.command('executed', {
  description: 'Check whether a treasury action for a proposal has executed.',
  args: z.object({
    proposalId: z.coerce.number().int().positive().describe('Governance proposal id'),
  }),
  env,
  output: z.object({
    proposalId: z.number(),
    executed: z.boolean(),
  }),
  examples: [{ args: { proposalId: 1 }, description: 'Check execution status for proposal #1' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const proposalCount = (await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposalCount',
    })) as bigint;

    if (c.args.proposalId > Number(proposalCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Proposal id ${c.args.proposalId} does not exist (proposalCount: ${proposalCount})`,
        retryable: false,
      });
    }

    const executed = (await client.readContract({
      abi: treasuryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.treasury,
      functionName: 'executedByProposal',
      args: [BigInt(c.args.proposalId)],
    })) as boolean;
    return c.ok({ proposalId: c.args.proposalId, executed });
  },
});

treasury.command('propose-spend', {
  description:
    'Create a council proposal that spends treasury funds via TreasuryTransferIntentModule.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  options: writeOptions.extend({
    token: z
      .string()
      .describe('Token address to spend (use 0x0000000000000000000000000000000000000000 for ETH)'),
    recipient: z.string().describe('Recipient address'),
    amount: z.string().describe('Token amount as decimal string (human units)'),
    decimals: z.coerce
      .number()
      .int()
      .min(0)
      .max(36)
      .default(18)
      .describe('Token decimals used to parse --amount (default: 18)'),
    title: z.string().min(1).describe('Proposal title'),
    description: z.string().min(1).describe('Proposal description'),
    category: z.string().default('treasury').describe('Forum category label for this proposal'),
    'risk-tier': z.coerce
      .number()
      .int()
      .min(0)
      .max(3)
      .default(3)
      .describe('Max allowed risk tier in intent constraints (0-3, default: 3)'),
  }),
  env: writeEnv,
  output: z.object({
    proposer: z.string(),
    category: z.string(),
    token: z.string(),
    recipient: z.string(),
    amount: z.string(),
    amountWei: z.string(),
    expectedProposalId: z.number(),
    expectedThreadId: z.number(),
    tx: txResultOutput,
  }),
  examples: [
    {
      options: {
        token: '0x0000000000000000000000000000000000000000',
        recipient: '0x00000000000000000000000000000000000000b0',
        amount: '0.5',
        title: 'Fund grants round',
        description: 'Allocate 0.5 ETH from treasury to the grants multisig.',
      },
      description: 'Propose a treasury spend transfer',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const account = resolveAccount(c.env);

    const token = toChecksum(c.options.token) as Address;
    const recipient = toChecksum(c.options.recipient) as Address;

    let amountWei: bigint;
    try {
      amountWei = parseUnits(c.options.amount, c.options.decimals);
    } catch {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: `Invalid amount "${c.options.amount}" for decimals=${c.options.decimals}.`,
        retryable: false,
      });
    }

    if (amountWei <= 0n) {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: '--amount must be greater than zero.',
        retryable: false,
      });
    }

    const [activeMember, isCouncilMember, transferModule, proposalCount, threadCount, whitelisted] =
      (await Promise.all([
        client.readContract({
          abi: registryAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.registry,
          functionName: 'isActive',
          args: [account.address],
        }),
        client.readContract({
          abi: councilSeatsAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.councilSeats,
          functionName: 'isCouncilMember',
          args: [account.address],
        }),
        client.readContract({
          abi: treasuryAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.treasury,
          functionName: 'treasuryTransferModule',
        }),
        client.readContract({
          abi: governanceAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.governance,
          functionName: 'proposalCount',
        }),
        client.readContract({
          abi: forumAbi,
          address: ABSTRACT_MAINNET_ADDRESSES.forum,
          functionName: 'threadCount',
        }),
        token === zeroAddress
          ? Promise.resolve(true)
          : client.readContract({
              abi: treasuryAbi,
              address: ABSTRACT_MAINNET_ADDRESSES.treasury,
              functionName: 'isAssetWhitelisted',
              args: [token],
            }),
      ])) as [boolean, boolean, string, bigint, bigint, boolean];

    if (!activeMember) {
      return c.error({
        code: 'NOT_ACTIVE_MEMBER',
        message: `Address ${toChecksum(account.address)} is not an active Assembly member.`,
        retryable: false,
      });
    }

    if (!isCouncilMember) {
      return c.error({
        code: 'NOT_COUNCIL_MEMBER',
        message: `Address ${toChecksum(account.address)} is not an active council member and cannot create treasury spend proposals.`,
        retryable: false,
      });
    }

    if (!whitelisted) {
      return c.error({
        code: 'ASSET_NOT_WHITELISTED',
        message: `Token ${token} is not treasury-whitelisted for spending.`,
        retryable: false,
      });
    }

    const transferModuleAllowed = (await client.readContract({
      abi: treasuryAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.treasury,
      functionName: 'isIntentModuleAllowed',
      args: [transferModule],
    })) as boolean;

    if (!transferModuleAllowed) {
      return c.error({
        code: 'INTENT_MODULE_DISABLED',
        message: `Treasury transfer intent module ${toChecksum(transferModule)} is currently disabled.`,
        retryable: false,
      });
    }

    const moduleData = encodeAbiParameters(
      [
        { name: 'asset', type: 'address' },
        { name: 'recipient', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      [token, recipient, amountWei],
    );

    const proposalInput = {
      kind: 2,
      title: c.options.title,
      description: c.options.description,
      intentSteps: [
        {
          module: transferModule,
          moduleData,
        },
      ],
      intentConstraints: {
        deadline: 0,
        maxAllowedRiskTier: c.options['risk-tier'],
      },
      configUpdates: [],
    };

    const expectedProposalId = Number(proposalCount) + 1;
    const expectedThreadId = Number(threadCount) + 1;

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
        token,
        recipient,
        amount: c.options.amount,
        amountWei: amountWei.toString(),
        expectedProposalId,
        expectedThreadId,
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
