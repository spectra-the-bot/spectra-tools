import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { checksumAddress } from '@spectratools/cli-shared';
import {
  initTelemetry,
  shutdownTelemetry,
  withCommandSpan,
} from '@spectratools/cli-shared/telemetry';
import { Cli, z } from 'incur';
import { formatUnits } from 'viem';
import type { Address } from 'viem';

import { cl } from './commands/cl.js';
import { gauges } from './commands/gauges.js';
import { lending, readLendingSummary } from './commands/lending.js';
import { pools } from './commands/pools.js';
import { readVaultSummary, vaults } from './commands/vaults.js';
import { ve } from './commands/ve.js';
import { voter } from './commands/voter.js';
import {
  clFactoryAbi,
  minterAbi,
  poolFactoryAbi,
  voterAbi,
  votingEscrowAbi,
} from './contracts/abis.js';
import { ABOREAN_CL_ADDRESSES, ABOREAN_V2_ADDRESSES } from './contracts/addresses.js';
import { createAboreanPublicClient } from './contracts/client.js';
import { applyFriendlyErrorHandling } from './error-handling.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

const cli = Cli.create('aborean', {
  version: pkg.version,
  description: 'Aborean Finance DEX CLI for Abstract chain.',
});

cli.command(gauges);
cli.command(pools);
cli.command(ve);
cli.command(voter);
cli.command(cl);
cli.command(vaults);
cli.command(lending);

const rootEnv = z.object({
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
] as const;

const v2PoolLiteAbi = [
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
  {
    type: 'function',
    name: 'stable',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getReserves',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { type: 'uint256', name: 'reserve0' },
      { type: 'uint256', name: 'reserve1' },
      { type: 'uint256', name: 'blockTimestampLast' },
    ],
  },
] as const;

type TokenMeta = {
  address: Address;
  symbol: string;
  decimals: number;
};

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function normalizeReserveTuple(value: unknown): { reserve0: bigint; reserve1: bigint } {
  if (Array.isArray(value)) {
    return {
      reserve0: BigInt(value[0] as bigint),
      reserve1: BigInt(value[1] as bigint),
    };
  }

  const row = value as { reserve0: bigint; reserve1: bigint };
  return {
    reserve0: BigInt(row.reserve0),
    reserve1: BigInt(row.reserve1),
  };
}

async function readTokenMetadata(
  client: ReturnType<typeof createAboreanPublicClient>,
  tokenAddresses: readonly Address[],
): Promise<Map<string, TokenMeta>> {
  const unique = [...new Set(tokenAddresses.map((address) => address.toLowerCase()))] as Address[];

  if (!unique.length) {
    return new Map();
  }

  const contracts = unique.flatMap((address) => [
    {
      abi: erc20MetadataAbi,
      address,
      functionName: 'symbol',
    },
    {
      abi: erc20MetadataAbi,
      address,
      functionName: 'decimals',
    },
  ]);

  const results = (await client.multicall({
    allowFailure: true,
    contracts,
  })) as Array<{ status: 'success'; result: unknown } | { status: 'failure'; error: unknown }>;

  const map = new Map<string, TokenMeta>();

  for (let i = 0; i < unique.length; i += 1) {
    const address = checksumAddress(unique[i]) as Address;
    const symbolResult = results[i * 2];
    const decimalsResult = results[i * 2 + 1];

    const symbol =
      symbolResult && symbolResult.status === 'success' && typeof symbolResult.result === 'string'
        ? symbolResult.result
        : shortAddress(address);

    const decimals =
      decimalsResult &&
      decimalsResult.status === 'success' &&
      typeof decimalsResult.result === 'number'
        ? decimalsResult.result
        : 18;

    map.set(address.toLowerCase(), {
      address,
      symbol,
      decimals,
    });
  }

  return map;
}

async function readTopV2PoolsSnapshot(
  client: ReturnType<typeof createAboreanPublicClient>,
  limit: number,
): Promise<{ topPools: Array<Record<string, unknown>>; reserveUnitTvl: number }> {
  const v2PoolCount = (await client.readContract({
    abi: poolFactoryAbi,
    address: ABOREAN_V2_ADDRESSES.poolFactory,
    functionName: 'allPoolsLength',
  })) as bigint;

  if (v2PoolCount === 0n) {
    return { topPools: [], reserveUnitTvl: 0 };
  }

  const indices = Array.from({ length: Number(v2PoolCount) }, (_, i) => BigInt(i));

  const pools = (await client.multicall({
    allowFailure: false,
    contracts: indices.map((index) => ({
      abi: poolFactoryAbi,
      address: ABOREAN_V2_ADDRESSES.poolFactory,
      functionName: 'allPools',
      args: [index] as const,
    })),
  })) as Address[];

  const poolData = await client.multicall({
    allowFailure: false,
    contracts: pools.flatMap((pool) => [
      {
        abi: v2PoolLiteAbi,
        address: pool,
        functionName: 'token0',
      },
      {
        abi: v2PoolLiteAbi,
        address: pool,
        functionName: 'token1',
      },
      {
        abi: v2PoolLiteAbi,
        address: pool,
        functionName: 'stable',
      },
      {
        abi: v2PoolLiteAbi,
        address: pool,
        functionName: 'getReserves',
      },
    ]),
  });

  const tokenAddresses: Address[] = [];

  for (let i = 0; i < pools.length; i += 1) {
    tokenAddresses.push(checksumAddress(poolData[i * 4] as string) as Address);
    tokenAddresses.push(checksumAddress(poolData[i * 4 + 1] as string) as Address);
  }

  const tokenMeta = await readTokenMetadata(client, tokenAddresses);

  const rows = pools.map((pool, index) => {
    const token0Address = checksumAddress(poolData[index * 4] as string) as Address;
    const token1Address = checksumAddress(poolData[index * 4 + 1] as string) as Address;
    const stable = Boolean(poolData[index * 4 + 2]);
    const reserves = normalizeReserveTuple(poolData[index * 4 + 3]);

    const token0 =
      tokenMeta.get(token0Address.toLowerCase()) ??
      ({
        address: token0Address,
        symbol: shortAddress(token0Address),
        decimals: 18,
      } satisfies TokenMeta);

    const token1 =
      tokenMeta.get(token1Address.toLowerCase()) ??
      ({
        address: token1Address,
        symbol: shortAddress(token1Address),
        decimals: 18,
      } satisfies TokenMeta);

    const reserve0Decimal = finiteOrZero(Number(formatUnits(reserves.reserve0, token0.decimals)));
    const reserve1Decimal = finiteOrZero(Number(formatUnits(reserves.reserve1, token1.decimals)));
    const tvlUnits = reserve0Decimal + reserve1Decimal;

    return {
      pool: checksumAddress(pool),
      pair: `${token0.symbol}/${token1.symbol}`,
      poolType: stable ? 'stable' : 'volatile',
      token0: {
        address: checksumAddress(token0.address),
        symbol: token0.symbol,
        decimals: token0.decimals,
      },
      token1: {
        address: checksumAddress(token1.address),
        symbol: token1.symbol,
        decimals: token1.decimals,
      },
      reserves: {
        token0: formatUnits(reserves.reserve0, token0.decimals),
        token1: formatUnits(reserves.reserve1, token1.decimals),
      },
      tvlEstimateUnits: tvlUnits,
    };
  });

  const reserveUnitTvl = rows.reduce((sum, row) => sum + Number(row.tvlEstimateUnits), 0);

  return {
    topPools: rows
      .sort((a, b) => Number(b.tvlEstimateUnits) - Number(a.tvlEstimateUnits))
      .slice(0, limit),
    reserveUnitTvl,
  };
}

cli.command('status', {
  description:
    'Cross-protocol Aborean snapshot (TVL estimates, epoch, top pools, ve lock, vaults, Morpho lending).',
  env: rootEnv,
  output: z.object({
    v2PoolCount: z.number().describe('Number of V2 AMM pools'),
    clPoolCount: z.number().describe('Number of Slipstream (CL) pools'),
    gaugeCount: z.number().describe('Number of pools with gauges'),
    totalVotingWeight: z.string().describe('Total voting weight (wei)'),
    veABXTotalSupply: z.string().describe('Total veABX supply (wei)'),
    veABXLockedSupply: z.string().describe('Total ABX locked in VotingEscrow (wei)'),
    epoch: z.object({
      activePeriod: z.number(),
      epochEnd: z.number(),
      secondsRemaining: z.number(),
      epochCount: z.number(),
      weeklyEmission: z.string(),
    }),
    topPools: z.array(
      z.object({
        pool: z.string(),
        pair: z.string(),
        poolType: z.enum(['stable', 'volatile']),
        token0: z.object({
          address: z.string(),
          symbol: z.string(),
          decimals: z.number(),
        }),
        token1: z.object({
          address: z.string(),
          symbol: z.string(),
          decimals: z.number(),
        }),
        reserves: z.object({
          token0: z.string(),
          token1: z.string(),
        }),
        tvlEstimateUnits: z.number(),
      }),
    ),
    tvl: z.object({
      v2ReserveUnitEstimate: z.number(),
      vaultManagedVotingPower: z.string(),
    }),
    vaults: z.object({
      relayCount: z.number(),
      managedVotingPower: z.string(),
      note: z.string().nullable(),
    }),
    lending: z.object({
      available: z.boolean(),
      morpho: z.string(),
      marketCount: z.number(),
      supplyByLoanToken: z.array(
        z.object({
          token: z.string(),
          symbol: z.string(),
          decimals: z.number(),
          totalSupplyAssets: z.string(),
          totalBorrowAssets: z.string(),
        }),
      ),
      note: z.string().nullable(),
    }),
  }),
  examples: [{ description: 'Fetch the current Aborean protocol status' }],
  async run(c) {
    return withCommandSpan('aborean status', {}, async () => {
      const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

      const [
        v2PoolCount,
        clPoolCount,
        gaugeCount,
        totalVotingWeight,
        veABXTotalSupply,
        veABXLockedSupply,
        activePeriod,
        weekSeconds,
        epochCount,
        weeklyEmission,
        v2PoolSnapshot,
      ] = await Promise.all([
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
        client.readContract({
          abi: voterAbi,
          address: ABOREAN_V2_ADDRESSES.voter,
          functionName: 'length',
        }),
        client.readContract({
          abi: voterAbi,
          address: ABOREAN_V2_ADDRESSES.voter,
          functionName: 'totalWeight',
        }),
        client.readContract({
          abi: votingEscrowAbi,
          address: ABOREAN_V2_ADDRESSES.votingEscrow,
          functionName: 'totalSupply',
        }),
        client.readContract({
          abi: votingEscrowAbi,
          address: ABOREAN_V2_ADDRESSES.votingEscrow,
          functionName: 'supply',
        }),
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
        readTopV2PoolsSnapshot(client, 5),
      ]);

      let vaultRelayCount = 0;
      let vaultManagedVotingPower = '0';
      let vaultNote: string | null = null;

      try {
        const vaultSnapshot = await readVaultSummary(client);
        vaultRelayCount = vaultSnapshot.relayCount;
        vaultManagedVotingPower = vaultSnapshot.totals.managedVotingPower;
      } catch (error) {
        vaultNote = error instanceof Error ? error.message : 'vault snapshot unavailable';
      }

      let lendingAvailable = false;
      let lendingMarketCount = 0;
      let lendingMorpho = '';
      let lendingSupplyByLoanToken: Array<{
        token: string;
        symbol: string;
        decimals: number;
        totalSupplyAssets: string;
        totalBorrowAssets: string;
      }> = [];
      let lendingNote: string | null = null;

      try {
        const lendingSnapshot = await readLendingSummary(client);
        lendingAvailable = lendingSnapshot.available;
        lendingMarketCount = lendingSnapshot.marketCount;
        lendingMorpho = lendingSnapshot.morpho;
        lendingSupplyByLoanToken = lendingSnapshot.supplyByLoanToken;
      } catch (error) {
        lendingMorpho = '';
        lendingNote = error instanceof Error ? error.message : 'lending snapshot unavailable';
      }

      const now = Math.floor(Date.now() / 1000);
      const epochEnd = Number(activePeriod) + Number(weekSeconds);

      return c.ok(
        {
          v2PoolCount: Number(v2PoolCount),
          clPoolCount: Number(clPoolCount),
          gaugeCount: Number(gaugeCount),
          totalVotingWeight: String(totalVotingWeight),
          veABXTotalSupply: String(veABXTotalSupply),
          veABXLockedSupply: String(veABXLockedSupply),
          epoch: {
            activePeriod: Number(activePeriod),
            epochEnd,
            secondsRemaining: Math.max(0, epochEnd - now),
            epochCount: Number(epochCount),
            weeklyEmission: String(weeklyEmission),
          },
          topPools: v2PoolSnapshot.topPools as Array<{
            pool: string;
            pair: string;
            poolType: 'stable' | 'volatile';
            token0: { address: string; symbol: string; decimals: number };
            token1: { address: string; symbol: string; decimals: number };
            reserves: { token0: string; token1: string };
            tvlEstimateUnits: number;
          }>,
          tvl: {
            v2ReserveUnitEstimate: v2PoolSnapshot.reserveUnitTvl,
            vaultManagedVotingPower,
          },
          vaults: {
            relayCount: vaultRelayCount,
            managedVotingPower: vaultManagedVotingPower,
            note: vaultNote,
          },
          lending: {
            available: lendingAvailable,
            morpho: lendingMorpho,
            marketCount: lendingMarketCount,
            supplyByLoanToken: lendingSupplyByLoanToken,
            note: lendingNote,
          },
        },
        c.format === 'json' || c.format === 'jsonl'
          ? undefined
          : {
              cta: {
                description: 'Drill down:',
                commands: [
                  {
                    command: 'pools list' as const,
                    description: 'List V2 AMM pools',
                  },
                  {
                    command: 'cl pools' as const,
                    description: 'List Slipstream CL pools',
                  },
                  {
                    command: 'gauges list' as const,
                    description: 'List active gauges',
                  },
                  {
                    command: 've stats' as const,
                    description: 'View veABX global stats',
                  },
                ],
              },
            },
      );
    });
  },
});

applyFriendlyErrorHandling(cli);
initTelemetry('aborean');
process.on('beforeExit', () => shutdownTelemetry());
cli.serve();

export { cli };
