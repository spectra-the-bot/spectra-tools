import { Cli, z } from 'incur';
import type { Address } from 'viem';

import {
  clFactoryAbi,
  minterAbi,
  poolFactoryAbi,
  rewardsDistributorAbi,
  voterAbi,
  votingRewardAbi,
} from '../contracts/abis.js';
import { ABOREAN_CL_ADDRESSES, ABOREAN_V2_ADDRESSES } from '../contracts/addresses.js';
import { createAboreanPublicClient } from '../contracts/client.js';
import { ZERO_ADDRESS, asNum, clampPositive, relTime, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

async function discoverPools(
  client: ReturnType<typeof createAboreanPublicClient>,
): Promise<Address[]> {
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

  return [...(v2Pools as Address[]), ...(clPools as Address[])];
}

export const voter = Cli.create('voter', {
  description: 'Inspect Aborean voter epoch, pool weights, and claimable rewards context.',
});

voter.command('epoch', {
  description: 'Show current emissions epoch timing from Minter.',
  env,
  output: z.object({
    activePeriod: z.number(),
    epochEnd: z.number(),
    secondsRemaining: z.number(),
    timeRemaining: z.string(),
    weekSeconds: z.number(),
    epochCount: z.number(),
    weeklyEmission: z.string(),
  }),
  examples: [{ description: 'Inspect current voter epoch boundaries' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const [activePeriod, weekSeconds, epochCount, weeklyEmission] = (await Promise.all([
      client.readContract({
        abi: minterAbi,
        address: ABOREAN_V2_ADDRESSES.minter,
        functionName: 'activePeriod',
      }),
      client.readContract({
        abi: minterAbi,
        address: ABOREAN_V2_ADDRESSES.minter,
        functionName: 'WEEK',
      }),
      client.readContract({
        abi: minterAbi,
        address: ABOREAN_V2_ADDRESSES.minter,
        functionName: 'epochCount',
      }),
      client.readContract({
        abi: minterAbi,
        address: ABOREAN_V2_ADDRESSES.minter,
        functionName: 'weekly',
      }),
    ])) as [bigint, bigint, bigint, bigint];

    const now = Math.floor(Date.now() / 1000);
    const epochEnd = asNum(activePeriod + weekSeconds);

    return c.ok(
      {
        activePeriod: asNum(activePeriod),
        epochEnd,
        secondsRemaining: clampPositive(epochEnd - now),
        timeRemaining: relTime(activePeriod + weekSeconds),
        weekSeconds: asNum(weekSeconds),
        epochCount: asNum(epochCount),
        weeklyEmission: weeklyEmission.toString(),
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 'voter weights' as const,
                  description: 'View pool voting weight distribution',
                },
                {
                  command: 'gauges list' as const,
                  description: 'List active gauges',
                },
              ],
            },
          },
    );
  },
});

voter.command('weights', {
  description: 'Show current pool voting weight distribution.',
  env,
  output: z.object({
    totalWeight: z.string(),
    pools: z.array(
      z.object({
        pool: z.string(),
        gauge: z.string(),
        weight: z.string(),
      }),
    ),
    count: z.number(),
  }),
  examples: [{ description: 'List all pools with non-zero voting weight' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const pools = await discoverPools(client);
    if (!pools.length) {
      return c.ok({ totalWeight: '0', pools: [], count: 0 });
    }

    const [totalWeight, poolData] = await Promise.all([
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'totalWeight',
      }),
      client.multicall({
        allowFailure: false,
        contracts: pools.flatMap((pool) => [
          {
            abi: voterAbi,
            address: ABOREAN_V2_ADDRESSES.voter,
            functionName: 'gauges',
            args: [pool] as const,
          },
          {
            abi: voterAbi,
            address: ABOREAN_V2_ADDRESSES.voter,
            functionName: 'weights',
            args: [pool] as const,
          },
        ]),
      }),
    ]);

    const entries = pools
      .map((pool, index) => {
        const offset = index * 2;
        const gauge = (poolData[offset] as Address) ?? (ZERO_ADDRESS as Address);
        const weight = (poolData[offset + 1] as bigint) ?? 0n;

        return {
          pool,
          gauge,
          weight,
        };
      })
      .filter(
        (entry) => entry.gauge.toLowerCase() !== ZERO_ADDRESS.toLowerCase() && entry.weight > 0n,
      )
      .sort((a, b) => (a.weight > b.weight ? -1 : a.weight < b.weight ? 1 : 0))
      .map((entry) => ({
        pool: toChecksum(entry.pool),
        gauge: toChecksum(entry.gauge),
        weight: entry.weight.toString(),
      }));

    const firstEntry = entries[0];

    return c.ok(
      {
        totalWeight: (totalWeight as bigint).toString(),
        pools: entries,
        count: entries.length,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 'voter epoch' as const,
                  description: 'View current epoch timing',
                },
                ...(firstEntry
                  ? [
                      {
                        command: 'voter bribes' as const,
                        args: { pool: firstEntry.pool },
                        description: 'View bribe rewards for top-weighted pool',
                      },
                    ]
                  : []),
              ],
            },
          },
    );
  },
});

voter.command('rewards', {
  description: 'Show claimable rebase rewards and voting context for a veNFT.',
  args: z.object({
    tokenId: z.coerce.number().int().nonnegative().describe('veNFT token id'),
  }),
  env,
  output: z.object({
    tokenId: z.number(),
    rewardToken: z.string(),
    claimableRebase: z.string(),
    timeCursor: z.number(),
    lastTokenTime: z.number(),
    distributorStartTime: z.number(),
    usedWeight: z.string(),
    lastVoted: z.number(),
  }),
  examples: [{ args: { tokenId: 1 }, description: 'Check claimable voter/distributor rewards' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const tokenId = BigInt(c.args.tokenId);

    const [
      rewardToken,
      claimableRebase,
      timeCursor,
      lastTokenTime,
      distributorStartTime,
      usedWeight,
      lastVoted,
    ] = (await Promise.all([
      client.readContract({
        abi: rewardsDistributorAbi,
        address: ABOREAN_V2_ADDRESSES.rewardsDistributor,
        functionName: 'token',
      }),
      client.readContract({
        abi: rewardsDistributorAbi,
        address: ABOREAN_V2_ADDRESSES.rewardsDistributor,
        functionName: 'claimable',
        args: [tokenId],
      }),
      client.readContract({
        abi: rewardsDistributorAbi,
        address: ABOREAN_V2_ADDRESSES.rewardsDistributor,
        functionName: 'timeCursorOf',
        args: [tokenId],
      }),
      client.readContract({
        abi: rewardsDistributorAbi,
        address: ABOREAN_V2_ADDRESSES.rewardsDistributor,
        functionName: 'lastTokenTime',
      }),
      client.readContract({
        abi: rewardsDistributorAbi,
        address: ABOREAN_V2_ADDRESSES.rewardsDistributor,
        functionName: 'startTime',
      }),
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'usedWeights',
        args: [tokenId],
      }),
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'lastVoted',
        args: [tokenId],
      }),
    ])) as [Address, bigint, bigint, bigint, bigint, bigint, bigint];

    return c.ok(
      {
        tokenId: c.args.tokenId,
        rewardToken: toChecksum(rewardToken),
        claimableRebase: claimableRebase.toString(),
        timeCursor: asNum(timeCursor),
        lastTokenTime: asNum(lastTokenTime),
        distributorStartTime: asNum(distributorStartTime),
        usedWeight: usedWeight.toString(),
        lastVoted: asNum(lastVoted),
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 've lock' as const,
                  args: { tokenId: c.args.tokenId },
                  description: 'View lock details for this veNFT',
                },
                {
                  command: 'voter weights' as const,
                  description: 'Check pool voting weight distribution',
                },
              ],
            },
          },
    );
  },
});

voter.command('bribes', {
  description: 'Show active bribe reward tokens and current-epoch amounts for a pool.',
  args: z.object({
    pool: z.string().describe('Pool address'),
  }),
  env,
  output: z.object({
    pool: z.string(),
    gauge: z.string(),
    bribeContract: z.string(),
    epochStart: z.number(),
    rewardTokens: z.array(
      z.object({
        token: z.string(),
        epochAmount: z.string(),
      }),
    ),
    count: z.number(),
  }),
  examples: [
    {
      args: { pool: '0x0000000000000000000000000000000000000001' },
      description: 'Inspect bribe reward tokens for one pool',
    },
  ],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const [gauge, epochStart] = (await Promise.all([
      client.readContract({
        abi: voterAbi,
        address: ABOREAN_V2_ADDRESSES.voter,
        functionName: 'gauges',
        args: [c.args.pool as Address],
      }),
      client.readContract({
        abi: minterAbi,
        address: ABOREAN_V2_ADDRESSES.minter,
        functionName: 'activePeriod',
      }),
    ])) as [Address, bigint];

    if (gauge.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      return c.error({
        code: 'NOT_FOUND',
        message: `No gauge exists for pool ${c.args.pool}`,
        retryable: false,
      });
    }

    const bribeContract = (await client.readContract({
      abi: voterAbi,
      address: ABOREAN_V2_ADDRESSES.voter,
      functionName: 'gaugeToBribe',
      args: [gauge],
    })) as Address;

    if (bribeContract.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      return c.ok({
        pool: toChecksum(c.args.pool),
        gauge: toChecksum(gauge),
        bribeContract: toChecksum(bribeContract),
        epochStart: asNum(epochStart),
        rewardTokens: [],
        count: 0,
      });
    }

    const rewardsLength = (await client.readContract({
      abi: votingRewardAbi,
      address: bribeContract,
      functionName: 'rewardsListLength',
    })) as bigint;

    const tokenCount = asNum(rewardsLength);
    if (!tokenCount) {
      return c.ok({
        pool: toChecksum(c.args.pool),
        gauge: toChecksum(gauge),
        bribeContract: toChecksum(bribeContract),
        epochStart: asNum(epochStart),
        rewardTokens: [],
        count: 0,
      });
    }

    const tokenIndices = Array.from({ length: tokenCount }, (_, i) => BigInt(i));

    const rewardTokens = (await client.multicall({
      allowFailure: false,
      contracts: tokenIndices.map((index) => ({
        abi: votingRewardAbi,
        address: bribeContract,
        functionName: 'rewards',
        args: [index] as const,
      })),
    })) as Address[];

    const epochAmounts = (await client.multicall({
      allowFailure: false,
      contracts: rewardTokens.map((token) => ({
        abi: votingRewardAbi,
        address: bribeContract,
        functionName: 'tokenRewardsPerEpoch',
        args: [token, epochStart] as const,
      })),
    })) as bigint[];

    const items = rewardTokens.map((token, index) => ({
      token: toChecksum(token),
      epochAmount: epochAmounts[index].toString(),
    }));

    return c.ok(
      {
        pool: toChecksum(c.args.pool),
        gauge: toChecksum(gauge),
        bribeContract: toChecksum(bribeContract),
        epochStart: asNum(epochStart),
        rewardTokens: items,
        count: items.length,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 'gauges info' as const,
                  args: { gauge: toChecksum(gauge) },
                  description: 'Inspect gauge details',
                },
                {
                  command: 'voter epoch' as const,
                  description: 'View current epoch timing',
                },
              ],
            },
          },
    );
  },
});
