import { checksumAddress, isAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { formatUnits } from 'viem';
import type { Address, Hex } from 'viem';

import { ABOREAN_LENDING_ADDRESSES } from '../contracts/addresses.js';
import { createAboreanPublicClient } from '../contracts/client.js';
import { asNum, toChecksum } from './_common.js';

const MORPHO_DEPLOY_BLOCK = 13_947_713n;

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

const morphoAbi = [
  {
    type: 'event',
    name: 'CreateMarket',
    inputs: [
      { type: 'bytes32', name: 'id', indexed: true },
      {
        type: 'tuple',
        name: 'marketParams',
        indexed: false,
        components: [
          { type: 'address', name: 'loanToken' },
          { type: 'address', name: 'collateralToken' },
          { type: 'address', name: 'oracle' },
          { type: 'address', name: 'irm' },
          { type: 'uint256', name: 'lltv' },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'idToMarketParams',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32', name: 'id' }],
    outputs: [
      { type: 'address', name: 'loanToken' },
      { type: 'address', name: 'collateralToken' },
      { type: 'address', name: 'oracle' },
      { type: 'address', name: 'irm' },
      { type: 'uint256', name: 'lltv' },
    ],
  },
  {
    type: 'function',
    name: 'market',
    stateMutability: 'view',
    inputs: [{ type: 'bytes32', name: 'id' }],
    outputs: [
      { type: 'uint128', name: 'totalSupplyAssets' },
      { type: 'uint128', name: 'totalSupplyShares' },
      { type: 'uint128', name: 'totalBorrowAssets' },
      { type: 'uint128', name: 'totalBorrowShares' },
      { type: 'uint128', name: 'lastUpdate' },
      { type: 'uint128', name: 'fee' },
    ],
  },
  {
    type: 'function',
    name: 'position',
    stateMutability: 'view',
    inputs: [
      { type: 'bytes32', name: 'id' },
      { type: 'address', name: 'user' },
    ],
    outputs: [
      { type: 'uint256', name: 'supplyShares' },
      { type: 'uint128', name: 'borrowShares' },
      { type: 'uint128', name: 'collateral' },
    ],
  },
] as const;

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

type MorphoMarketParams = {
  loanToken: Address;
  collateralToken: Address;
  oracle: Address;
  irm: Address;
  lltv: bigint;
};

type MorphoMarketState = {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
};

type TokenMeta = {
  address: Address;
  symbol: string;
  decimals: number;
};

const tokenMetaSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

const lendingMarketRowSchema = z.object({
  marketId: z.string(),
  loanToken: tokenMetaSchema,
  collateralToken: tokenMetaSchema,
  oracle: z.string(),
  irm: z.string(),
  lltvBps: z.number(),
  lltvPercent: z.number(),
  totalSupplyAssets: z.string(),
  totalBorrowAssets: z.string(),
  totalSupplyShares: z.string(),
  totalBorrowShares: z.string(),
  availableLiquidityAssets: z.string(),
  utilization: z.number().nullable(),
  feeWad: z.string(),
  lastUpdate: z.number(),
});

export type LendingSummarySnapshot = {
  available: boolean;
  morpho: string;
  marketCount: number;
  supplyByLoanToken: Array<{
    token: string;
    symbol: string;
    decimals: number;
    totalSupplyAssets: string;
    totalBorrowAssets: string;
  }>;
};

function isMarketId(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function sharesToAssets(shares: bigint, totalShares: bigint, totalAssets: bigint): bigint {
  if (shares === 0n || totalShares === 0n) return 0n;
  return (shares * totalAssets) / totalShares;
}

function normalizeMarketParams(value: unknown): MorphoMarketParams {
  if (Array.isArray(value)) {
    return {
      loanToken: checksumAddress(String(value[0])) as Address,
      collateralToken: checksumAddress(String(value[1])) as Address,
      oracle: checksumAddress(String(value[2])) as Address,
      irm: checksumAddress(String(value[3])) as Address,
      lltv: BigInt(value[4] as bigint),
    };
  }

  if (typeof value !== 'object' || value === null) {
    throw new Error('invalid market params');
  }

  const v = value as Record<string, unknown>;

  return {
    loanToken: checksumAddress(String(v.loanToken)) as Address,
    collateralToken: checksumAddress(String(v.collateralToken)) as Address,
    oracle: checksumAddress(String(v.oracle)) as Address,
    irm: checksumAddress(String(v.irm)) as Address,
    lltv: BigInt(v.lltv as bigint),
  };
}

function normalizeMarketState(value: unknown): MorphoMarketState {
  if (Array.isArray(value)) {
    return {
      totalSupplyAssets: BigInt(value[0] as bigint),
      totalSupplyShares: BigInt(value[1] as bigint),
      totalBorrowAssets: BigInt(value[2] as bigint),
      totalBorrowShares: BigInt(value[3] as bigint),
      lastUpdate: BigInt(value[4] as bigint),
      fee: BigInt(value[5] as bigint),
    };
  }

  if (typeof value !== 'object' || value === null) {
    throw new Error('invalid market state');
  }

  const v = value as Record<string, unknown>;

  return {
    totalSupplyAssets: BigInt(v.totalSupplyAssets as bigint),
    totalSupplyShares: BigInt(v.totalSupplyShares as bigint),
    totalBorrowAssets: BigInt(v.totalBorrowAssets as bigint),
    totalBorrowShares: BigInt(v.totalBorrowShares as bigint),
    lastUpdate: BigInt(v.lastUpdate as bigint),
    fee: BigInt(v.fee as bigint),
  };
}

function toMarketRow(
  marketId: Hex,
  params: MorphoMarketParams,
  state: MorphoMarketState,
  tokenMeta: Map<string, TokenMeta>,
) {
  const loanMeta =
    tokenMeta.get(params.loanToken.toLowerCase()) ??
    ({
      address: params.loanToken,
      symbol: shortAddress(params.loanToken),
      decimals: 18,
    } satisfies TokenMeta);

  const collateralMeta =
    tokenMeta.get(params.collateralToken.toLowerCase()) ??
    ({
      address: params.collateralToken,
      symbol: shortAddress(params.collateralToken),
      decimals: 18,
    } satisfies TokenMeta);

  const utilization =
    state.totalSupplyAssets === 0n
      ? null
      : finiteOrNull(Number(state.totalBorrowAssets) / Number(state.totalSupplyAssets));

  const lltvPercent = Number(params.lltv) / 1e16;

  return {
    marketId,
    loanToken: {
      address: toChecksum(loanMeta.address),
      symbol: loanMeta.symbol,
      decimals: loanMeta.decimals,
    },
    collateralToken: {
      address: toChecksum(collateralMeta.address),
      symbol: collateralMeta.symbol,
      decimals: collateralMeta.decimals,
    },
    oracle: toChecksum(params.oracle),
    irm: toChecksum(params.irm),
    lltvBps: Math.round(lltvPercent * 100),
    lltvPercent,
    totalSupplyAssets: state.totalSupplyAssets.toString(),
    totalBorrowAssets: state.totalBorrowAssets.toString(),
    totalSupplyShares: state.totalSupplyShares.toString(),
    totalBorrowShares: state.totalBorrowShares.toString(),
    availableLiquidityAssets: (state.totalSupplyAssets - state.totalBorrowAssets).toString(),
    utilization,
    feeWad: state.fee.toString(),
    lastUpdate: asNum(state.lastUpdate),
  };
}

async function readTokenMetadata(
  client: ReturnType<typeof createAboreanPublicClient>,
  addresses: readonly Address[],
): Promise<Map<string, TokenMeta>> {
  const unique = [...new Set(addresses.map((address) => address.toLowerCase()))] as Address[];

  if (unique.length === 0) {
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
    const address = unique[i];
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
      address: checksumAddress(address) as Address,
      symbol,
      decimals,
    });
  }

  return map;
}

async function discoverMarketIds(
  client: ReturnType<typeof createAboreanPublicClient>,
): Promise<Hex[]> {
  const logs = await client.getContractEvents({
    address: ABOREAN_LENDING_ADDRESSES.morphoBlue,
    abi: morphoAbi,
    eventName: 'CreateMarket',
    fromBlock: MORPHO_DEPLOY_BLOCK,
    toBlock: 'latest',
  });

  const seen = new Set<string>();
  const ids: Hex[] = [];

  for (const log of logs) {
    const id = log.args.id as Hex | undefined;
    if (!id) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    ids.push(id);
  }

  return ids;
}

async function readMarkets(
  client: ReturnType<typeof createAboreanPublicClient>,
  marketIds: readonly Hex[],
): Promise<Array<{ marketId: Hex; params: MorphoMarketParams; state: MorphoMarketState }>> {
  if (marketIds.length === 0) return [];

  const contracts = marketIds.flatMap((marketId) => [
    {
      abi: morphoAbi,
      address: ABOREAN_LENDING_ADDRESSES.morphoBlue,
      functionName: 'idToMarketParams',
      args: [marketId] as const,
    },
    {
      abi: morphoAbi,
      address: ABOREAN_LENDING_ADDRESSES.morphoBlue,
      functionName: 'market',
      args: [marketId] as const,
    },
  ]);

  const values = await client.multicall({
    allowFailure: false,
    contracts,
  });

  return marketIds.map((marketId, index) => {
    const paramsValue = values[index * 2];
    const stateValue = values[index * 2 + 1];

    return {
      marketId,
      params: normalizeMarketParams(paramsValue),
      state: normalizeMarketState(stateValue),
    };
  });
}

function summarizeByLoanToken(
  markets: ReadonlyArray<{ marketId: Hex; params: MorphoMarketParams; state: MorphoMarketState }>,
  tokenMeta: Map<string, TokenMeta>,
): LendingSummarySnapshot['supplyByLoanToken'] {
  const byLoanToken = new Map<
    string,
    { token: Address; totalSupply: bigint; totalBorrow: bigint }
  >();

  for (const { params, state } of markets) {
    const key = params.loanToken.toLowerCase();
    const prev = byLoanToken.get(key);
    if (prev) {
      prev.totalSupply += state.totalSupplyAssets;
      prev.totalBorrow += state.totalBorrowAssets;
      continue;
    }

    byLoanToken.set(key, {
      token: params.loanToken,
      totalSupply: state.totalSupplyAssets,
      totalBorrow: state.totalBorrowAssets,
    });
  }

  return [...byLoanToken.values()].map((entry) => {
    const meta =
      tokenMeta.get(entry.token.toLowerCase()) ??
      ({
        address: entry.token,
        symbol: shortAddress(entry.token),
        decimals: 18,
      } satisfies TokenMeta);

    return {
      token: toChecksum(entry.token),
      symbol: meta.symbol,
      decimals: meta.decimals,
      totalSupplyAssets: entry.totalSupply.toString(),
      totalBorrowAssets: entry.totalBorrow.toString(),
    };
  });
}

export async function readLendingSummary(
  client: ReturnType<typeof createAboreanPublicClient>,
): Promise<LendingSummarySnapshot> {
  const marketIds = await discoverMarketIds(client);
  const markets = await readMarkets(client, marketIds);

  const tokenMeta = await readTokenMetadata(
    client,
    markets.flatMap((market) => [market.params.loanToken, market.params.collateralToken]),
  );

  return {
    available: true,
    morpho: toChecksum(ABOREAN_LENDING_ADDRESSES.morphoBlue),
    marketCount: marketIds.length,
    supplyByLoanToken: summarizeByLoanToken(markets, tokenMeta),
  };
}

export const lending = Cli.create('lending', {
  description: 'Inspect Morpho lending markets on Abstract.',
});

lending.command('markets', {
  description: 'List Morpho markets discovered from CreateMarket events.',
  options: z.object({
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(200)
      .default(25)
      .describe('Max markets to return'),
  }),
  env,
  output: z.object({
    morpho: z.string(),
    marketCount: z.number(),
    markets: z.array(lendingMarketRowSchema),
    totalsByLoanToken: z.array(
      z.object({
        token: z.string(),
        symbol: z.string(),
        decimals: z.number(),
        totalSupplyAssets: z.string(),
        totalBorrowAssets: z.string(),
      }),
    ),
  }),
  examples: [{ description: 'List active Morpho markets on Abstract' }],
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const marketIds = await discoverMarketIds(client);
    const markets = await readMarkets(client, marketIds);

    const tokenMeta = await readTokenMetadata(
      client,
      markets.flatMap((market) => [market.params.loanToken, market.params.collateralToken]),
    );

    const rows = markets
      .map((market) => toMarketRow(market.marketId, market.params, market.state, tokenMeta))
      .sort((a, b) =>
        BigInt(a.totalSupplyAssets) > BigInt(b.totalSupplyAssets)
          ? -1
          : BigInt(a.totalSupplyAssets) < BigInt(b.totalSupplyAssets)
            ? 1
            : 0,
      )
      .slice(0, c.options.limit);

    const firstMarket = rows[0];

    return c.ok(
      {
        morpho: toChecksum(ABOREAN_LENDING_ADDRESSES.morphoBlue),
        marketCount: marketIds.length,
        markets: rows,
        totalsByLoanToken: summarizeByLoanToken(markets, tokenMeta),
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Explore lending:',
              commands: [
                ...(firstMarket
                  ? [
                      {
                        command: 'lending market' as const,
                        args: { marketId: firstMarket.marketId },
                        description: `Inspect ${firstMarket.loanToken.symbol}/${firstMarket.collateralToken.symbol} market`,
                      },
                    ]
                  : []),
                {
                  command: 'pools list' as const,
                  description: 'View V2 AMM pools',
                },
              ],
            },
          },
    );
  },
});

lending.command('market', {
  description: 'Get details for one Morpho market id (bytes32).',
  args: z.object({
    marketId: z.string().describe('Morpho market id (bytes32 hex)'),
  }),
  env,
  output: lendingMarketRowSchema,
  examples: [
    {
      args: { marketId: '0xfe1d7da2fbde85b1fee120c88df3e6b55164a2442dab97486d3d4f719a5ff1fb' },
      description: 'Inspect one Morpho market by id',
    },
  ],
  async run(c) {
    if (!isMarketId(c.args.marketId)) {
      return c.error({
        code: 'INVALID_ARGUMENT',
        message: 'marketId must be a 32-byte hex string (0x + 64 hex chars)',
      });
    }

    const marketId = c.args.marketId as Hex;
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const [paramsRaw, stateRaw] = (await Promise.all([
      client.readContract({
        abi: morphoAbi,
        address: ABOREAN_LENDING_ADDRESSES.morphoBlue,
        functionName: 'idToMarketParams',
        args: [marketId] as const,
      }),
      client.readContract({
        abi: morphoAbi,
        address: ABOREAN_LENDING_ADDRESSES.morphoBlue,
        functionName: 'market',
        args: [marketId] as const,
      }),
    ])) as [unknown, unknown];

    const params = normalizeMarketParams(paramsRaw);
    const state = normalizeMarketState(stateRaw);

    const tokenMeta = await readTokenMetadata(client, [params.loanToken, params.collateralToken]);

    const row = toMarketRow(marketId, params, state, tokenMeta);

    return c.ok(
      row,
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 'lending position' as const,
                  args: { marketId, user: '<address>' },
                  description: 'Inspect a user position in this market',
                },
                {
                  command: 'lending markets' as const,
                  description: 'List all Morpho markets',
                },
              ],
            },
          },
    );
  },
});

lending.command('position', {
  description: 'Inspect one user position in a Morpho market.',
  args: z.object({
    marketId: z.string().describe('Morpho market id (bytes32 hex)'),
    user: z.string().describe('Position owner address'),
  }),
  env,
  output: z.object({
    marketId: z.string(),
    user: z.string(),
    loanToken: tokenMetaSchema,
    collateralToken: tokenMetaSchema,
    supplyShares: z.string(),
    supplyAssetsEstimate: z.object({
      raw: z.string(),
      decimal: z.string(),
    }),
    borrowShares: z.string(),
    borrowAssetsEstimate: z.object({
      raw: z.string(),
      decimal: z.string(),
    }),
    collateralAssets: z.object({
      raw: z.string(),
      decimal: z.string(),
    }),
  }),
  examples: [
    {
      args: {
        marketId: '0xfe1d7da2fbde85b1fee120c88df3e6b55164a2442dab97486d3d4f719a5ff1fb',
        user: '0x0000000000000000000000000000000000000000',
      },
      description: 'Inspect one user position in a market',
    },
  ],
  async run(c) {
    if (!isMarketId(c.args.marketId)) {
      return c.error({
        code: 'INVALID_ARGUMENT',
        message: 'marketId must be a 32-byte hex string (0x + 64 hex chars)',
      });
    }

    if (!isAddress(c.args.user)) {
      return c.error({
        code: 'INVALID_ARGUMENT',
        message: 'user must be a valid address',
      });
    }

    const marketId = c.args.marketId as Hex;
    const user = checksumAddress(c.args.user) as Address;
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const [paramsRaw, stateRaw, positionRaw] = (await Promise.all([
      client.readContract({
        abi: morphoAbi,
        address: ABOREAN_LENDING_ADDRESSES.morphoBlue,
        functionName: 'idToMarketParams',
        args: [marketId] as const,
      }),
      client.readContract({
        abi: morphoAbi,
        address: ABOREAN_LENDING_ADDRESSES.morphoBlue,
        functionName: 'market',
        args: [marketId] as const,
      }),
      client.readContract({
        abi: morphoAbi,
        address: ABOREAN_LENDING_ADDRESSES.morphoBlue,
        functionName: 'position',
        args: [marketId, user] as const,
      }),
    ])) as [unknown, unknown, unknown];

    const params = normalizeMarketParams(paramsRaw);
    const state = normalizeMarketState(stateRaw);

    const position = Array.isArray(positionRaw)
      ? {
          supplyShares: BigInt(positionRaw[0] as bigint),
          borrowShares: BigInt(positionRaw[1] as bigint),
          collateral: BigInt(positionRaw[2] as bigint),
        }
      : {
          supplyShares: BigInt((positionRaw as { supplyShares: bigint }).supplyShares),
          borrowShares: BigInt((positionRaw as { borrowShares: bigint }).borrowShares),
          collateral: BigInt((positionRaw as { collateral: bigint }).collateral),
        };

    const tokenMeta = await readTokenMetadata(client, [params.loanToken, params.collateralToken]);

    const loanMeta =
      tokenMeta.get(params.loanToken.toLowerCase()) ??
      ({
        address: params.loanToken,
        symbol: shortAddress(params.loanToken),
        decimals: 18,
      } satisfies TokenMeta);

    const collateralMeta =
      tokenMeta.get(params.collateralToken.toLowerCase()) ??
      ({
        address: params.collateralToken,
        symbol: shortAddress(params.collateralToken),
        decimals: 18,
      } satisfies TokenMeta);

    const supplyAssetsEstimate = sharesToAssets(
      BigInt(position.supplyShares),
      state.totalSupplyShares,
      state.totalSupplyAssets,
    );

    const borrowAssetsEstimate = sharesToAssets(
      BigInt(position.borrowShares),
      state.totalBorrowShares,
      state.totalBorrowAssets,
    );

    return c.ok(
      {
        marketId,
        user: toChecksum(user),
        loanToken: {
          address: toChecksum(loanMeta.address),
          symbol: loanMeta.symbol,
          decimals: loanMeta.decimals,
        },
        collateralToken: {
          address: toChecksum(collateralMeta.address),
          symbol: collateralMeta.symbol,
          decimals: collateralMeta.decimals,
        },
        supplyShares: position.supplyShares.toString(),
        supplyAssetsEstimate: {
          raw: supplyAssetsEstimate.toString(),
          decimal: formatUnits(supplyAssetsEstimate, loanMeta.decimals),
        },
        borrowShares: position.borrowShares.toString(),
        borrowAssetsEstimate: {
          raw: borrowAssetsEstimate.toString(),
          decimal: formatUnits(borrowAssetsEstimate, loanMeta.decimals),
        },
        collateralAssets: {
          raw: position.collateral.toString(),
          decimal: formatUnits(BigInt(position.collateral), collateralMeta.decimals),
        },
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 'lending market' as const,
                  args: { marketId },
                  description: 'View market details',
                },
                {
                  command: 'lending markets' as const,
                  description: 'List all Morpho markets',
                },
              ],
            },
          },
    );
  },
});
