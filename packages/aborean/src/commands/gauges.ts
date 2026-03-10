import { isAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import type { Abi, Address } from 'viem';

import { clFactoryAbi, gaugeAbi, poolFactoryAbi, voterAbi } from '../contracts/abis.js';
import { ABOREAN_CL_ADDRESSES, ABOREAN_V2_ADDRESSES } from '../contracts/addresses.js';
import { createAboreanPublicClient } from '../contracts/client.js';
import { ZERO_ADDRESS, asNum, relTime, toChecksum } from './_common.js';
import { aboreanWriteTx, resolveAccount, writeEnv, writeOptions } from './_write-utils.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

const erc20ApproveAbi: Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

const gaugeDepositAbi: Abi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
];

const gaugeDepositWithTokenIdAbi: Abi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
  },
];

const gaugeWithdrawAbi: Abi = [
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
];

type GaugePool = {
  pool: Address;
  gauge: Address;
};

async function discoverGaugePools(
  client: ReturnType<typeof createAboreanPublicClient>,
): Promise<GaugePool[]> {
  const [v2PoolCount, clPoolCount] = (await Promise.all([
    client.readContract({
      abi: poolFactoryAbi,
      address: ABOREAN_V2_ADDRESSES.poolFactory,
      functionName: 'allPoolsLength',
    }),
    client.readContract({
      abi: clFactoryAbi,
      address: ABOREAN_CL_ADDRESSES.clFactory,
      functionName: 'allPoolsLength',
    }),
  ])) as [bigint, bigint];

  const v2Indices = Array.from({ length: asNum(v2PoolCount) }, (_, i) => BigInt(i));
  const clIndices = Array.from({ length: asNum(clPoolCount) }, (_, i) => BigInt(i));

  const [v2Pools, clPools] = await Promise.all([
    v2Indices.length
      ? client.multicall({
          allowFailure: false,
          contracts: v2Indices.map((index) => ({
            abi: poolFactoryAbi,
            address: ABOREAN_V2_ADDRESSES.poolFactory,
            functionName: 'allPools',
            args: [index] as const,
          })),
        })
      : Promise.resolve([]),
    clIndices.length
      ? client.multicall({
          allowFailure: false,
          contracts: clIndices.map((index) => ({
            abi: clFactoryAbi,
            address: ABOREAN_CL_ADDRESSES.clFactory,
            functionName: 'allPools',
            args: [index] as const,
          })),
        })
      : Promise.resolve([]),
  ]);

  const pools = [...(v2Pools as Address[]), ...(clPools as Address[])];
  if (!pools.length) return [];

  const gauges = (await client.multicall({
    allowFailure: false,
    contracts: pools.map((pool) => ({
      abi: voterAbi,
      address: ABOREAN_V2_ADDRESSES.voter,
      functionName: 'gauges',
      args: [pool] as const,
    })),
  })) as Address[];

  return pools
    .map((pool, index) => ({ pool, gauge: gauges[index] }))
    .filter(({ gauge }) => gauge.toLowerCase() !== ZERO_ADDRESS.toLowerCase());
}

export const gauges = Cli.create('gauges', {
  description: 'Inspect Aborean gauge emissions, staking, and user positions.',
});

gauges.command('list', {
  description: 'List active gauges with pool, emissions, and staking stats.',
  env,
  output: z.object({
    gauges: z.array(
      z.object({
        pool: z.string(),
        gauge: z.string(),
        rewardToken: z.string(),
        rewardRate: z.string(),
        totalStaked: z.string(),
        claimableEmissions: z.string(),
        periodFinish: z.number(),
        periodFinishRelative: z.string(),
      }),
    ),
    count: z.number(),
  }),
  examples: [{ description: 'List all active gauges and current emissions state' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const gaugePools = await discoverGaugePools(client);

    if (!gaugePools.length) {
      return c.ok({ gauges: [], count: 0 });
    }

    const details = (await client.multicall({
      allowFailure: false,
      contracts: gaugePools.flatMap(({ gauge }) => [
        {
          abi: gaugeAbi,
          address: gauge,
          functionName: 'rewardToken',
        },
        {
          abi: gaugeAbi,
          address: gauge,
          functionName: 'rewardRate',
        },
        {
          abi: gaugeAbi,
          address: gauge,
          functionName: 'totalSupply',
        },
        {
          abi: gaugeAbi,
          address: gauge,
          functionName: 'periodFinish',
        },
        {
          abi: voterAbi,
          address: ABOREAN_V2_ADDRESSES.voter,
          functionName: 'claimable',
          args: [gauge] as const,
        },
      ]),
    })) as Array<Address | bigint>;

    const items = gaugePools.map(({ pool, gauge }, index) => {
      const offset = index * 5;
      const rewardToken = details[offset] as Address;
      const rewardRate = details[offset + 1] as bigint;
      const totalStaked = details[offset + 2] as bigint;
      const periodFinish = details[offset + 3] as bigint;
      const claimableEmissions = details[offset + 4] as bigint;

      return {
        pool: toChecksum(pool),
        gauge: toChecksum(gauge),
        rewardToken: toChecksum(rewardToken),
        rewardRate: rewardRate.toString(),
        totalStaked: totalStaked.toString(),
        claimableEmissions: claimableEmissions.toString(),
        periodFinish: asNum(periodFinish),
        periodFinishRelative: relTime(periodFinish),
      };
    });

    const firstGauge = items[0];

    return c.ok(
      {
        gauges: items,
        count: items.length,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Explore gauges:',
              commands: firstGauge
                ? [
                    {
                      command: 'gauges info' as const,
                      args: { gauge: firstGauge.gauge },
                      description: 'Inspect top gauge details',
                    },
                  ]
                : [],
            },
          },
    );
  },
});

gauges.command('info', {
  description: 'Get detailed state for one gauge address.',
  args: z.object({
    gauge: z.string().describe('Gauge contract address'),
  }),
  env,
  output: z.object({
    gauge: z.string(),
    pool: z.string(),
    isAlive: z.boolean(),
    stakingToken: z.string(),
    rewardToken: z.string(),
    totalStaked: z.string(),
    rewardRate: z.string(),
    rewardPerTokenStored: z.string(),
    fees0: z.string(),
    fees1: z.string(),
    left: z.string(),
    periodFinish: z.number(),
    periodFinishRelative: z.string(),
    lastUpdateTime: z.number(),
    bribeContract: z.string(),
    feeContract: z.string(),
  }),
  examples: [
    {
      args: { gauge: '0x0000000000000000000000000000000000000001' },
      description: 'Inspect one gauge in detail',
    },
  ],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const gauge = c.args.gauge as Address;

    const [
      pool,
      isAlive,
      bribeContract,
      feeContract,
      stakingToken,
      rewardToken,
      totalStaked,
      rewardRate,
      periodFinish,
      lastUpdateTime,
      rewardPerTokenStored,
      fees0,
      fees1,
      left,
    ] = (await Promise.all([
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'poolForGauge',
        args: [gauge],
      }),
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'isAlive',
        args: [gauge],
      }),
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'gaugeToBribe',
        args: [gauge],
      }),
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'gaugeToFees',
        args: [gauge],
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'stakingToken',
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'rewardToken',
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'totalSupply',
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'rewardRate',
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'periodFinish',
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'lastUpdateTime',
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'rewardPerTokenStored',
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'fees0',
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'fees1',
      }),
      client.readContract({
        abi: gaugeAbi,
        address: gauge,
        functionName: 'left',
      }),
    ])) as [
      Address,
      boolean,
      Address,
      Address,
      Address,
      Address,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];

    return c.ok(
      {
        gauge: toChecksum(gauge),
        pool: toChecksum(pool),
        isAlive,
        stakingToken: toChecksum(stakingToken),
        rewardToken: toChecksum(rewardToken),
        totalStaked: totalStaked.toString(),
        rewardRate: rewardRate.toString(),
        rewardPerTokenStored: rewardPerTokenStored.toString(),
        fees0: fees0.toString(),
        fees1: fees1.toString(),
        left: left.toString(),
        periodFinish: asNum(periodFinish),
        periodFinishRelative: relTime(periodFinish),
        lastUpdateTime: asNum(lastUpdateTime),
        bribeContract: toChecksum(bribeContract),
        feeContract: toChecksum(feeContract),
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 've stats' as const,
                  description: 'View veABX global stats',
                },
                {
                  command: 'voter weights' as const,
                  description: 'Check pool voting weight distribution',
                },
                {
                  command: 'voter bribes' as const,
                  args: { pool: toChecksum(pool) },
                  description: 'View bribe rewards for this pool',
                },
              ],
            },
          },
    );
  },
});

gauges.command('staked', {
  description: 'Show one address staking positions across all gauges.',
  args: z.object({
    address: z.string().describe('Wallet address to inspect'),
  }),
  env,
  output: z.object({
    address: z.string(),
    positions: z.array(
      z.object({
        pool: z.string(),
        gauge: z.string(),
        rewardToken: z.string(),
        staked: z.string(),
        earned: z.string(),
      }),
    ),
    count: z.number(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      description: 'List gauge positions for a wallet',
    },
  ],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const gaugePools = await discoverGaugePools(client);

    if (!gaugePools.length) {
      return c.ok({
        address: toChecksum(c.args.address),
        positions: [],
        count: 0,
      });
    }

    const positionData = (await client.multicall({
      allowFailure: false,
      contracts: gaugePools.flatMap(({ gauge }) => [
        {
          abi: gaugeAbi,
          address: gauge,
          functionName: 'balanceOf',
          args: [c.args.address as Address] as const,
        },
        {
          abi: gaugeAbi,
          address: gauge,
          functionName: 'earned',
          args: [c.args.address as Address] as const,
        },
        {
          abi: gaugeAbi,
          address: gauge,
          functionName: 'rewardToken',
        },
      ]),
    })) as Array<bigint | Address>;

    const positions = gaugePools
      .map(({ pool, gauge }, index) => {
        const offset = index * 3;
        const staked = positionData[offset] as bigint;
        const earned = positionData[offset + 1] as bigint;
        const rewardToken = positionData[offset + 2] as Address;

        return {
          pool: toChecksum(pool),
          gauge: toChecksum(gauge),
          rewardToken: toChecksum(rewardToken),
          staked,
          earned,
        };
      })
      .filter((position) => position.staked > 0n || position.earned > 0n)
      .map((position) => ({
        pool: position.pool,
        gauge: position.gauge,
        rewardToken: position.rewardToken,
        staked: position.staked.toString(),
        earned: position.earned.toString(),
      }));

    const firstPosition = positions[0];

    return c.ok(
      {
        address: toChecksum(c.args.address),
        positions,
        count: positions.length,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                ...(firstPosition
                  ? [
                      {
                        command: 'gauges info' as const,
                        args: { gauge: firstPosition.gauge },
                        description: 'Inspect gauge details',
                      },
                    ]
                  : []),
                {
                  command: 've locks' as const,
                  args: { address: toChecksum(c.args.address) },
                  description: 'View veNFT locks for this address',
                },
              ],
            },
          },
    );
  },
});

gauges.command('deposit', {
  description:
    'Deposit LP tokens into a gauge for staking rewards. Optionally attach a veNFT tokenId for boosted emissions. Approves the gauge to spend LP tokens if needed.',
  options: z
    .object({
      gauge: z.string().describe('Gauge contract address'),
      amount: z.string().describe('Amount of LP tokens to deposit (in wei)'),
      'token-id': z.coerce
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe('veNFT token id for boosted emissions'),
    })
    .merge(writeOptions),
  env: writeEnv,
  output: z.object({
    gauge: z.string(),
    stakingToken: z.string(),
    amount: z.string(),
    tokenId: z.number().nullable(),
    tx: z.union([
      z.object({
        txHash: z.string(),
        blockNumber: z.number(),
        gasUsed: z.string(),
      }),
      z.object({
        dryRun: z.literal(true),
        estimatedGas: z.string(),
        simulationResult: z.unknown(),
      }),
    ]),
  }),
  examples: [
    {
      options: {
        gauge: '0x0000000000000000000000000000000000000001',
        amount: '1000000000000000000',
        'dry-run': true,
      },
      description: 'Dry-run deposit 1e18 LP tokens into a gauge',
    },
    {
      options: {
        gauge: '0x0000000000000000000000000000000000000001',
        amount: '1000000000000000000',
        'token-id': 42,
      },
      description: 'Deposit with veNFT boost',
    },
  ],
  async run(c) {
    const gaugeAddress = c.options.gauge;

    if (!isAddress(gaugeAddress)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid gauge address: "${gaugeAddress}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }

    const amount = BigInt(c.options.amount);
    if (amount <= 0n) {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: 'amount must be a positive integer in wei.',
      });
    }

    const gauge = gaugeAddress as Address;
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    // Verify gauge is alive
    const isAlive = (await client.readContract({
      abi: voterAbi,
      address: ABOREAN_V2_ADDRESSES.voter,
      functionName: 'isAlive',
      args: [gauge],
    })) as boolean;

    if (!isAlive) {
      return c.error({
        code: 'GAUGE_NOT_ALIVE',
        message: `Gauge ${toChecksum(gauge)} is not alive.`,
        retryable: false,
      });
    }

    // Get staking token
    const stakingToken = (await client.readContract({
      abi: gaugeAbi,
      address: gauge,
      functionName: 'stakingToken',
    })) as Address;

    const account = resolveAccount(c.env);

    // Approve gauge to spend LP tokens (skip for dry-run)
    if (!c.options['dry-run']) {
      const currentAllowance = (await client.readContract({
        abi: erc20ApproveAbi,
        address: stakingToken,
        functionName: 'allowance',
        args: [account.address, gauge],
      })) as bigint;

      if (currentAllowance < amount) {
        await aboreanWriteTx({
          env: c.env,
          options: { ...c.options, 'dry-run': false },
          address: stakingToken,
          abi: erc20ApproveAbi,
          functionName: 'approve',
          args: [gauge, amount],
        });
      }
    }

    const tokenId = c.options['token-id'];

    // Execute deposit
    const tx = await aboreanWriteTx({
      env: c.env,
      options: c.options,
      address: gauge,
      abi: tokenId !== undefined ? gaugeDepositWithTokenIdAbi : gaugeDepositAbi,
      functionName: 'deposit',
      args: tokenId !== undefined ? [amount, BigInt(tokenId)] : [amount],
    });

    return c.ok({
      gauge: toChecksum(gauge),
      stakingToken: toChecksum(stakingToken),
      amount: amount.toString(),
      tokenId: tokenId !== undefined ? tokenId : null,
      tx,
    });
  },
});

gauges.command('withdraw', {
  description: 'Withdraw LP tokens from a gauge.',
  options: z
    .object({
      gauge: z.string().describe('Gauge contract address'),
      amount: z.string().describe('Amount of LP tokens to withdraw (in wei)'),
    })
    .merge(writeOptions),
  env: writeEnv,
  output: z.object({
    gauge: z.string(),
    amount: z.string(),
    tx: z.union([
      z.object({
        txHash: z.string(),
        blockNumber: z.number(),
        gasUsed: z.string(),
      }),
      z.object({
        dryRun: z.literal(true),
        estimatedGas: z.string(),
        simulationResult: z.unknown(),
      }),
    ]),
  }),
  examples: [
    {
      options: {
        gauge: '0x0000000000000000000000000000000000000001',
        amount: '1000000000000000000',
        'dry-run': true,
      },
      description: 'Dry-run withdraw 1e18 LP tokens from a gauge',
    },
  ],
  async run(c) {
    const gaugeAddress = c.options.gauge;

    if (!isAddress(gaugeAddress)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid gauge address: "${gaugeAddress}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }

    const amount = BigInt(c.options.amount);
    if (amount <= 0n) {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: 'amount must be a positive integer in wei.',
      });
    }

    const gauge = gaugeAddress as Address;

    const tx = await aboreanWriteTx({
      env: c.env,
      options: c.options,
      address: gauge,
      abi: gaugeWithdrawAbi,
      functionName: 'withdraw',
      args: [amount],
    });

    return c.ok({
      gauge: toChecksum(gauge),
      amount: amount.toString(),
      tx,
    });
  },
});
