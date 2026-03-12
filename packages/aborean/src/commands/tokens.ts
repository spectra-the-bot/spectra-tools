import { checksumAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import type { Address } from 'viem';

import { poolFactoryAbi, v2PoolAbi } from '../contracts/abis.js';
import { ABOREAN_CL_ADDRESSES, ABOREAN_V2_ADDRESSES } from '../contracts/addresses.js';
import { createAboreanPublicClient } from '../contracts/client.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

const erc20MetadataAbi = [
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;

const clPoolTokenAbi = [
  {
    type: 'function',
    name: 'token0',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'token1',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
] as const;

const clFactoryAbi = [
  {
    type: 'function',
    name: 'allPoolsLength',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allPools',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
] as const;

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const tokenSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  name: z.string().nullable(),
  decimals: z.number(),
});

export const tokens = Cli.create('tokens', {
  description: 'List tokens traded on Aborean V2 and Slipstream (CL) pools.',
});

tokens.command('list', {
  description:
    'List unique tokens found across V2 and CL pools with symbol, name, decimals, and pool count.',
  options: z.object({
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(500)
      .default(50)
      .describe('Maximum tokens to return (max 500)'),
  }),
  env,
  output: z.object({
    tokenCount: z.number().describe('Number of unique tokens returned'),
    totalPoolCount: z.number().describe('Number of pools scanned'),
    tokens: z.array(
      tokenSchema.extend({
        poolCount: z.number().describe('Number of pools this token appears in'),
      }),
    ),
  }),
  examples: [
    { description: 'List tokens traded on Aborean' },
    { options: { limit: 10 }, description: 'List the top 10 tokens by pool count' },
  ],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const [v2PoolCountRaw, clPoolCountRaw] = await Promise.all([
      client.readContract({
        abi: poolFactoryAbi,
        address: ABOREAN_V2_ADDRESSES.poolFactory,
        functionName: 'allPoolsLength',
      }) as Promise<bigint>,
      client.readContract({
        abi: clFactoryAbi,
        address: ABOREAN_CL_ADDRESSES.clFactory,
        functionName: 'allPoolsLength',
      }) as Promise<bigint>,
    ]);

    const v2PoolCount = Number(v2PoolCountRaw);
    const clPoolCount = Number(clPoolCountRaw);
    const totalPoolCount = v2PoolCount + clPoolCount;

    // Fetch all V2 pool addresses
    const v2Indices = Array.from({ length: v2PoolCount }, (_, i) => BigInt(i));
    const v2PoolAddresses =
      v2PoolCount > 0
        ? ((await client.multicall({
            allowFailure: false,
            contracts: v2Indices.map((index) => ({
              abi: poolFactoryAbi,
              address: ABOREAN_V2_ADDRESSES.poolFactory,
              functionName: 'allPools' as const,
              args: [index] as const,
            })),
          })) as Address[])
        : [];

    // Fetch token addresses from V2 pools
    const v2TokenContracts = v2PoolAddresses.flatMap((pool) => [
      { abi: v2PoolAbi, address: pool, functionName: 'token0' as const },
      { abi: v2PoolAbi, address: pool, functionName: 'token1' as const },
    ]);

    const v2TokenResults =
      v2TokenContracts.length > 0
        ? ((await client.multicall({
            allowFailure: false,
            contracts: v2TokenContracts,
          })) as Address[])
        : [];

    // Fetch all CL pool addresses
    const clIndices = Array.from({ length: clPoolCount }, (_, i) => BigInt(i));
    const clPoolAddresses =
      clPoolCount > 0
        ? ((await client.multicall({
            allowFailure: false,
            contracts: clIndices.map((index) => ({
              abi: clFactoryAbi,
              address: ABOREAN_CL_ADDRESSES.clFactory,
              functionName: 'allPools' as const,
              args: [index] as const,
            })),
          })) as Address[])
        : [];

    // Fetch token addresses from CL pools
    const clTokenContracts = clPoolAddresses.flatMap((pool) => [
      { abi: clPoolTokenAbi, address: pool, functionName: 'token0' as const },
      { abi: clPoolTokenAbi, address: pool, functionName: 'token1' as const },
    ]);

    const clTokenResults =
      clTokenContracts.length > 0
        ? ((await client.multicall({
            allowFailure: false,
            contracts: clTokenContracts,
          })) as Address[])
        : [];

    // Collect unique tokens with pool counts
    const tokenPoolCounts = new Map<string, number>();

    for (let i = 0; i < v2PoolAddresses.length; i++) {
      const t0 = checksumAddress(v2TokenResults[i * 2] as string).toLowerCase();
      const t1 = checksumAddress(v2TokenResults[i * 2 + 1] as string).toLowerCase();
      tokenPoolCounts.set(t0, (tokenPoolCounts.get(t0) ?? 0) + 1);
      tokenPoolCounts.set(t1, (tokenPoolCounts.get(t1) ?? 0) + 1);
    }

    for (let i = 0; i < clPoolAddresses.length; i++) {
      const t0 = checksumAddress(clTokenResults[i * 2] as string).toLowerCase();
      const t1 = checksumAddress(clTokenResults[i * 2 + 1] as string).toLowerCase();
      tokenPoolCounts.set(t0, (tokenPoolCounts.get(t0) ?? 0) + 1);
      tokenPoolCounts.set(t1, (tokenPoolCounts.get(t1) ?? 0) + 1);
    }

    const uniqueAddresses = [...tokenPoolCounts.keys()] as Address[];

    // Fetch metadata for all unique tokens
    const metadataContracts = uniqueAddresses.flatMap((address) => [
      { abi: erc20MetadataAbi, address, functionName: 'symbol' as const },
      { abi: erc20MetadataAbi, address, functionName: 'decimals' as const },
      { abi: erc20MetadataAbi, address, functionName: 'name' as const },
    ]);

    const metadataResults =
      metadataContracts.length > 0
        ? ((await client.multicall({
            allowFailure: true,
            contracts: metadataContracts,
          })) as Array<
            { status: 'success'; result: unknown } | { status: 'failure'; error: unknown }
          >)
        : [];

    const tokenRows = uniqueAddresses.map((address, index) => {
      const symbolResult = metadataResults[index * 3];
      const decimalsResult = metadataResults[index * 3 + 1];
      const nameResult = metadataResults[index * 3 + 2];

      const checksummed = checksumAddress(address);

      const symbol =
        symbolResult && symbolResult.status === 'success' && typeof symbolResult.result === 'string'
          ? symbolResult.result
          : shortAddress(checksummed);

      const decimals =
        decimalsResult &&
        decimalsResult.status === 'success' &&
        typeof decimalsResult.result === 'number'
          ? decimalsResult.result
          : 18;

      const name =
        nameResult && nameResult.status === 'success' && typeof nameResult.result === 'string'
          ? nameResult.result
          : null;

      return {
        address: checksummed,
        symbol,
        name,
        decimals,
        poolCount: tokenPoolCounts.get(address) ?? 0,
      };
    });

    // Sort by pool count descending, then by symbol
    tokenRows.sort((a, b) => {
      if (b.poolCount !== a.poolCount) return b.poolCount - a.poolCount;
      return a.symbol.localeCompare(b.symbol);
    });

    const limited = tokenRows.slice(0, c.options.limit);

    return c.ok(
      {
        tokenCount: limited.length,
        totalPoolCount,
        tokens: limited,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Explore further:',
              commands: [
                {
                  command: 'pools list' as const,
                  description: 'List V2 AMM pools',
                },
                {
                  command: 'cl pools' as const,
                  description: 'List Slipstream CL pools',
                },
              ],
            },
          },
    );
  },
});
