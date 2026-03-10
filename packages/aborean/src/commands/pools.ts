import { checksumAddress, isAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { formatUnits, parseUnits } from 'viem';
import type { Abi, Address } from 'viem';

import { poolFactoryAbi, v2PoolAbi, v2RouterAbi } from '../contracts/abis.js';
import { ABOREAN_V2_ADDRESSES } from '../contracts/addresses.js';
import { createAboreanPublicClient } from '../contracts/client.js';
import { ZERO_ADDRESS } from './_common.js';
import { aboreanWriteTx, resolveAccount, writeEnv, writeOptions } from './_write-utils.js';

const MULTICALL_BATCH_SIZE = 100;

const DEFAULT_SLIPPAGE_PERCENT = 0.5;
const DEFAULT_DEADLINE_SECONDS = 300;

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

const v2RouterSwapAbi: Abi = [
  {
    type: 'function',
    name: 'swapExactTokensForTokens',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      {
        name: 'routes',
        type: 'tuple[]',
        components: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'stable', type: 'bool' },
          { name: 'factory', type: 'address' },
        ],
      },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
];

type TokenMeta = {
  address: Address;
  symbol: string;
  decimals: number;
};

type PoolState = {
  pool: Address;
  token0: Address;
  token1: Address;
  stable: boolean;
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: bigint;
  totalSupply: bigint;
};

type FeeInfo = {
  feeBps: number;
  feePercent: number;
};

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

const tokenSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

const amountSchema = z.object({
  raw: z.string(),
  decimal: z.string(),
});

const feeSchema = z
  .object({
    feeBps: z.number(),
    feePercent: z.number(),
  })
  .nullable();

const poolSummarySchema = z.object({
  pool: z.string(),
  pair: z.string(),
  stable: z.boolean(),
  poolType: z.enum(['stable', 'volatile']),
  token0: tokenSchema,
  token1: tokenSchema,
  reserves: z.object({
    token0: amountSchema,
    token1: amountSchema,
    blockTimestampLast: z.number(),
  }),
  totalSupply: z.string(),
  fee: feeSchema,
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

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function toAddress(address: string): Address {
  return checksumAddress(address) as Address;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function toFeeInfo(value: bigint | null): FeeInfo | null {
  if (value === null) return null;
  const feeBps = Number(value);
  return {
    feeBps,
    feePercent: feeBps / 10_000,
  };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
}

async function multicallStrict(
  client: ReturnType<typeof createAboreanPublicClient>,
  contracts: readonly unknown[],
): Promise<unknown[]> {
  if (contracts.length === 0) return [];

  const batches = chunk(contracts, MULTICALL_BATCH_SIZE);
  const output: unknown[] = [];

  for (const batch of batches) {
    const values = await client.multicall({
      allowFailure: false,
      contracts: batch as Parameters<typeof client.multicall>[0]['contracts'],
    });
    output.push(...values);
  }

  return output;
}

async function multicallAllowFailure(
  client: ReturnType<typeof createAboreanPublicClient>,
  contracts: readonly unknown[],
): Promise<Array<{ status: 'success'; result: unknown } | { status: 'failure'; error: unknown }>> {
  if (contracts.length === 0) return [];

  const batches = chunk(contracts, MULTICALL_BATCH_SIZE);
  const output: Array<
    { status: 'success'; result: unknown } | { status: 'failure'; error: unknown }
  > = [];

  for (const batch of batches) {
    const values = (await client.multicall({
      allowFailure: true,
      contracts: batch as Parameters<typeof client.multicall>[0]['contracts'],
    })) as Array<{ status: 'success'; result: unknown } | { status: 'failure'; error: unknown }>;
    output.push(...values);
  }

  return output;
}

function fallbackTokenMeta(address: Address): TokenMeta {
  const checksummed = checksumAddress(address) as Address;
  return {
    address: checksummed,
    symbol: shortAddress(checksummed),
    decimals: 18,
  };
}

async function readTokenMetadata(
  client: ReturnType<typeof createAboreanPublicClient>,
  tokenAddresses: readonly Address[],
): Promise<Map<string, TokenMeta>> {
  const unique = [
    ...new Set(tokenAddresses.map((address) => checksumAddress(address).toLowerCase())),
  ];
  if (unique.length === 0) {
    return new Map();
  }

  const contracts = unique.flatMap((address) => [
    {
      abi: erc20MetadataAbi,
      address: address as Address,
      functionName: 'symbol',
    },
    {
      abi: erc20MetadataAbi,
      address: address as Address,
      functionName: 'decimals',
    },
  ]);

  const values = await multicallAllowFailure(client, contracts);

  const map = new Map<string, TokenMeta>();

  for (let i = 0; i < unique.length; i += 1) {
    const address = unique[i] as Address;
    const symbolResult = values[i * 2];
    const decimalsResult = values[i * 2 + 1];

    const fallback = fallbackTokenMeta(address);

    const symbol =
      symbolResult && symbolResult.status === 'success' && typeof symbolResult.result === 'string'
        ? symbolResult.result
        : fallback.symbol;

    const decimals =
      decimalsResult &&
      decimalsResult.status === 'success' &&
      typeof decimalsResult.result === 'number'
        ? decimalsResult.result
        : fallback.decimals;

    map.set(address.toLowerCase(), {
      address: checksumAddress(address) as Address,
      symbol,
      decimals,
    });
  }

  return map;
}

async function readPoolStates(
  client: ReturnType<typeof createAboreanPublicClient>,
  pools: readonly Address[],
): Promise<PoolState[]> {
  if (pools.length === 0) {
    return [];
  }

  const contracts = pools.flatMap((pool) => [
    {
      abi: v2PoolAbi,
      address: pool,
      functionName: 'token0',
    },
    {
      abi: v2PoolAbi,
      address: pool,
      functionName: 'token1',
    },
    {
      abi: v2PoolAbi,
      address: pool,
      functionName: 'stable',
    },
    {
      abi: v2PoolAbi,
      address: pool,
      functionName: 'getReserves',
    },
    {
      abi: v2PoolAbi,
      address: pool,
      functionName: 'totalSupply',
    },
  ]);

  const values = await multicallStrict(client, contracts);

  return pools.map((pool, index) => {
    const offset = index * 5;
    const reserves = values[offset + 3] as readonly [bigint, bigint, bigint];

    return {
      pool,
      token0: values[offset] as Address,
      token1: values[offset + 1] as Address,
      stable: values[offset + 2] as boolean,
      reserve0: reserves[0],
      reserve1: reserves[1],
      blockTimestampLast: reserves[2],
      totalSupply: values[offset + 4] as bigint,
    };
  });
}

async function readPoolFees(
  client: ReturnType<typeof createAboreanPublicClient>,
  pools: readonly { pool: Address; stable: boolean }[],
): Promise<Array<bigint | null>> {
  if (pools.length === 0) {
    return [];
  }

  const contracts = pools.map(({ pool, stable }) => ({
    abi: poolFactoryAbi,
    address: ABOREAN_V2_ADDRESSES.poolFactory,
    functionName: 'getFee',
    args: [pool, stable] as const,
  }));

  const values = await multicallAllowFailure(client, contracts);

  return values.map((value) =>
    value.status === 'success' && typeof value.result === 'bigint' ? value.result : null,
  );
}

function toAmount(raw: bigint, decimals: number) {
  return {
    raw: raw.toString(),
    decimal: formatUnits(raw, decimals),
  };
}

function toPoolSummary(
  state: PoolState,
  tokens: Map<string, TokenMeta>,
  fee: bigint | null,
): z.infer<typeof poolSummarySchema> {
  const token0 = tokens.get(state.token0.toLowerCase()) ?? fallbackTokenMeta(state.token0);
  const token1 = tokens.get(state.token1.toLowerCase()) ?? fallbackTokenMeta(state.token1);

  return {
    pool: checksumAddress(state.pool),
    pair: `${token0.symbol}/${token1.symbol}`,
    stable: state.stable,
    poolType: state.stable ? 'stable' : 'volatile',
    token0,
    token1,
    reserves: {
      token0: toAmount(state.reserve0, token0.decimals),
      token1: toAmount(state.reserve1, token1.decimals),
      blockTimestampLast: Number(state.blockTimestampLast),
    },
    totalSupply: state.totalSupply.toString(),
    fee: toFeeInfo(fee),
  };
}

export const pools = Cli.create('pools', {
  description: 'Inspect V2 AMM pools, reserves, quotes, and fee configuration.',
});

pools.command('list', {
  description: 'List V2 pools with token pairs, reserves, and stable/volatile type.',
  options: z.object({
    offset: z.coerce.number().int().nonnegative().default(0).describe('Pool index offset'),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .max(500)
      .default(50)
      .describe('Maximum pools to return (max 500)'),
  }),
  env,
  output: z.object({
    total: z.number(),
    offset: z.number(),
    limit: z.number(),
    count: z.number(),
    pools: z.array(poolSummarySchema),
  }),
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    const totalRaw = (await client.readContract({
      abi: poolFactoryAbi,
      address: ABOREAN_V2_ADDRESSES.poolFactory,
      functionName: 'allPoolsLength',
    })) as bigint;

    const total = Number(totalRaw);
    const offset = Math.min(c.options.offset, total);
    const end = Math.min(total, offset + c.options.limit);

    if (offset >= end) {
      return c.ok({
        total,
        offset,
        limit: c.options.limit,
        count: 0,
        pools: [],
      });
    }

    const indices = Array.from({ length: end - offset }, (_, i) => BigInt(offset + i));

    const poolAddresses = (await multicallStrict(
      client,
      indices.map((index) => ({
        abi: poolFactoryAbi,
        address: ABOREAN_V2_ADDRESSES.poolFactory,
        functionName: 'allPools',
        args: [index] as const,
      })),
    )) as Address[];

    const poolStates = await readPoolStates(client, poolAddresses);
    const tokenMeta = await readTokenMetadata(
      client,
      poolStates.flatMap((pool) => [pool.token0, pool.token1]),
    );
    const fees = await readPoolFees(
      client,
      poolStates.map((pool) => ({ pool: pool.pool, stable: pool.stable })),
    );

    const summaries = poolStates.map((pool, index) =>
      toPoolSummary(pool, tokenMeta, fees[index] ?? null),
    );
    const firstPool = summaries[0];

    return c.ok(
      {
        total,
        offset,
        limit: c.options.limit,
        count: summaries.length,
        pools: summaries,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Explore pools:',
              commands: [
                ...(firstPool
                  ? [
                      {
                        command: 'pools pool' as const,
                        args: { address: firstPool.pool },
                        description: `Inspect ${firstPool.pair}`,
                      },
                    ]
                  : []),
                ...(firstPool
                  ? [
                      {
                        command: 'pools fees' as const,
                        args: { pool: firstPool.pool },
                        description: `Check fees for ${firstPool.pair}`,
                      },
                    ]
                  : []),
              ],
            },
          },
    );
  },
});

pools.command('pool', {
  description: 'Get detailed state for one V2 pool.',
  args: z.object({
    address: z.string().describe('Pool address'),
  }),
  env,
  output: z.object({
    pool: poolSummarySchema.extend({
      poolFees: z.string(),
      factory: z.string(),
    }),
  }),
  async run(c) {
    if (!isAddress(c.args.address)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid pool address: "${c.args.address}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }

    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const poolAddress = toAddress(c.args.address);

    const [token0, token1, stable, reserves, totalSupply, poolFees, factory] =
      (await multicallStrict(client, [
        {
          abi: v2PoolAbi,
          address: poolAddress,
          functionName: 'token0',
        },
        {
          abi: v2PoolAbi,
          address: poolAddress,
          functionName: 'token1',
        },
        {
          abi: v2PoolAbi,
          address: poolAddress,
          functionName: 'stable',
        },
        {
          abi: v2PoolAbi,
          address: poolAddress,
          functionName: 'getReserves',
        },
        {
          abi: v2PoolAbi,
          address: poolAddress,
          functionName: 'totalSupply',
        },
        {
          abi: v2PoolAbi,
          address: poolAddress,
          functionName: 'poolFees',
        },
        {
          abi: v2PoolAbi,
          address: poolAddress,
          functionName: 'factory',
        },
      ])) as [
        Address,
        Address,
        boolean,
        readonly [bigint, bigint, bigint],
        bigint,
        Address,
        Address,
      ];

    const tokenMeta = await readTokenMetadata(client, [token0, token1]);
    const [fee] = await readPoolFees(client, [{ pool: poolAddress, stable }]);

    const summary = toPoolSummary(
      {
        pool: poolAddress,
        token0,
        token1,
        stable,
        reserve0: reserves[0],
        reserve1: reserves[1],
        blockTimestampLast: reserves[2],
        totalSupply,
      },
      tokenMeta,
      fee ?? null,
    );

    return c.ok(
      {
        pool: {
          ...summary,
          poolFees: checksumAddress(poolFees),
          factory: checksumAddress(factory),
        },
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Next steps:',
              commands: [
                {
                  command: 'pools quote' as const,
                  args: {
                    tokenIn: summary.token0.address,
                    tokenOut: summary.token1.address,
                    amountIn: '1',
                  },
                  description: `Quote a ${summary.token0.symbol} → ${summary.token1.symbol} swap`,
                },
                {
                  command: 'pools fees' as const,
                  args: { pool: checksumAddress(poolAddress) },
                  description: 'Check fee configuration',
                },
              ],
            },
          },
    );
  },
});

pools.command('quote', {
  description: 'Quote a single-hop V2 swap between tokenIn and tokenOut.',
  args: z.object({
    tokenIn: z.string().describe('Input token address'),
    tokenOut: z.string().describe('Output token address'),
    amountIn: z.string().describe('Input amount in human-readable decimal units'),
  }),
  options: z.object({
    stable: z.boolean().default(false).describe('Use stable pool route (default: volatile)'),
  }),
  env,
  output: z.object({
    pool: z.string(),
    stable: z.boolean(),
    tokenIn: tokenSchema,
    tokenOut: tokenSchema,
    amountIn: amountSchema,
    amountOut: amountSchema,
    priceOutPerIn: z.number().nullable(),
  }),
  async run(c) {
    if (!isAddress(c.args.tokenIn) || !isAddress(c.args.tokenOut)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: 'tokenIn and tokenOut must both be valid 0x-prefixed 20-byte addresses.',
      });
    }

    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const tokenIn = toAddress(c.args.tokenIn);
    const tokenOut = toAddress(c.args.tokenOut);

    const tokenMeta = await readTokenMetadata(client, [tokenIn, tokenOut]);
    const inMeta = tokenMeta.get(tokenIn.toLowerCase()) ?? fallbackTokenMeta(tokenIn);
    const outMeta = tokenMeta.get(tokenOut.toLowerCase()) ?? fallbackTokenMeta(tokenOut);

    let amountInRaw: bigint;
    try {
      amountInRaw = parseUnits(c.args.amountIn, inMeta.decimals);
    } catch {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: `Invalid amountIn: "${c.args.amountIn}" for token ${inMeta.symbol} (${inMeta.decimals} decimals).`,
      });
    }

    const poolAddress = (await client.readContract({
      abi: poolFactoryAbi,
      address: ABOREAN_V2_ADDRESSES.poolFactory,
      functionName: 'getPool',
      args: [tokenIn, tokenOut, c.options.stable],
    })) as Address;

    if (poolAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      return c.error({
        code: 'POOL_NOT_FOUND',
        message: `No ${c.options.stable ? 'stable' : 'volatile'} V2 pool found for pair ${checksumAddress(
          tokenIn,
        )}/${checksumAddress(tokenOut)}.`,
      });
    }

    const amounts = (await client.readContract({
      abi: v2RouterAbi,
      address: ABOREAN_V2_ADDRESSES.router,
      functionName: 'getAmountsOut',
      args: [
        amountInRaw,
        [
          {
            from: tokenIn,
            to: tokenOut,
            stable: c.options.stable,
            factory: ABOREAN_V2_ADDRESSES.poolFactory,
          },
        ],
      ],
    })) as bigint[];

    const amountOutRaw = amounts[amounts.length - 1] ?? 0n;

    const amountInDecimal = formatUnits(amountInRaw, inMeta.decimals);
    const amountOutDecimal = formatUnits(amountOutRaw, outMeta.decimals);

    const ratio = Number(amountOutDecimal) / Number(amountInDecimal);

    return c.ok(
      {
        pool: checksumAddress(poolAddress),
        stable: c.options.stable,
        tokenIn: inMeta,
        tokenOut: outMeta,
        amountIn: {
          raw: amountInRaw.toString(),
          decimal: amountInDecimal,
        },
        amountOut: {
          raw: amountOutRaw.toString(),
          decimal: amountOutDecimal,
        },
        priceOutPerIn: Number(amountInDecimal) === 0 ? null : finiteOrNull(ratio),
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 'pools pool' as const,
                  args: { address: checksumAddress(poolAddress) },
                  description: 'Inspect the pool used for this quote',
                },
                {
                  command: 'pools quote' as const,
                  args: {
                    tokenIn: outMeta.address,
                    tokenOut: inMeta.address,
                    amountIn: amountOutDecimal,
                  },
                  description: `Reverse quote ${outMeta.symbol} → ${inMeta.symbol}`,
                },
              ],
            },
          },
    );
  },
});

pools.command('fees', {
  description: 'Read V2 fee configuration for a pool address.',
  args: z.object({
    pool: z.string().describe('Pool address'),
  }),
  env,
  output: z.object({
    pool: z.string(),
    pair: z.string(),
    stable: z.boolean(),
    activeFee: feeSchema,
    stableFee: feeSchema,
    volatileFee: feeSchema,
  }),
  async run(c) {
    if (!isAddress(c.args.pool)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid pool address: "${c.args.pool}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }

    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const pool = toAddress(c.args.pool);

    const [token0, token1, stable] = (await multicallStrict(client, [
      {
        abi: v2PoolAbi,
        address: pool,
        functionName: 'token0',
      },
      {
        abi: v2PoolAbi,
        address: pool,
        functionName: 'token1',
      },
      {
        abi: v2PoolAbi,
        address: pool,
        functionName: 'stable',
      },
    ])) as [Address, Address, boolean];

    const tokenMeta = await readTokenMetadata(client, [token0, token1]);
    const token0Meta = tokenMeta.get(token0.toLowerCase()) ?? fallbackTokenMeta(token0);
    const token1Meta = tokenMeta.get(token1.toLowerCase()) ?? fallbackTokenMeta(token1);

    const [stableFeeRaw, volatileFeeRaw] = await readPoolFees(client, [
      { pool, stable: true },
      { pool, stable: false },
    ]);

    const stableFee = toFeeInfo(stableFeeRaw ?? null);
    const volatileFee = toFeeInfo(volatileFeeRaw ?? null);

    return c.ok(
      {
        pool: checksumAddress(pool),
        pair: `${token0Meta.symbol}/${token1Meta.symbol}`,
        stable,
        activeFee: stable ? stableFee : volatileFee,
        stableFee,
        volatileFee,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 'pools pool' as const,
                  args: { address: checksumAddress(pool) },
                  description: 'View full pool state',
                },
                {
                  command: 'pools quote' as const,
                  args: {
                    tokenIn: token0Meta.address,
                    tokenOut: token1Meta.address,
                    amountIn: '1',
                  },
                  description: `Quote a ${token0Meta.symbol} → ${token1Meta.symbol} swap`,
                },
              ],
            },
          },
    );
  },
});

pools.command('swap', {
  description:
    'Execute a single-hop V2 AMM swap. Quotes the expected output, applies slippage tolerance, approves the router if needed, and broadcasts the swap transaction.',
  options: z
    .object({
      'token-in': z.string().describe('Input token address'),
      'token-out': z.string().describe('Output token address'),
      'amount-in': z.string().describe('Input amount in wei'),
      slippage: z.coerce
        .number()
        .min(0)
        .max(100)
        .default(DEFAULT_SLIPPAGE_PERCENT)
        .describe('Slippage tolerance in percent (default: 0.5)'),
      deadline: z.coerce
        .number()
        .int()
        .positive()
        .default(DEFAULT_DEADLINE_SECONDS)
        .describe('Transaction deadline in seconds from now (default: 300)'),
      stable: z.boolean().default(false).describe('Use stable pool route (default: volatile)'),
    })
    .merge(writeOptions),
  env: writeEnv,
  output: z.object({
    pool: z.string(),
    stable: z.boolean(),
    tokenIn: tokenSchema,
    tokenOut: tokenSchema,
    amountIn: amountSchema,
    expectedAmountOut: amountSchema,
    minAmountOut: amountSchema,
    slippagePercent: z.number(),
    effectivePrice: z.number().nullable(),
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
  async run(c) {
    const tokenInRaw = c.options['token-in'];
    const tokenOutRaw = c.options['token-out'];

    if (!isAddress(tokenInRaw) || !isAddress(tokenOutRaw)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: 'token-in and token-out must both be valid 0x-prefixed 20-byte addresses.',
      });
    }

    const tokenIn = toAddress(tokenInRaw);
    const tokenOut = toAddress(tokenOutRaw);
    const amountInRaw = BigInt(c.options['amount-in']);

    if (amountInRaw <= 0n) {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: 'amount-in must be a positive integer in wei.',
      });
    }

    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);

    // Fetch token metadata
    const tokenMeta = await readTokenMetadata(client, [tokenIn, tokenOut]);
    const inMeta = tokenMeta.get(tokenIn.toLowerCase()) ?? fallbackTokenMeta(tokenIn);
    const outMeta = tokenMeta.get(tokenOut.toLowerCase()) ?? fallbackTokenMeta(tokenOut);

    // Find the pool
    const poolAddress = (await client.readContract({
      abi: poolFactoryAbi,
      address: ABOREAN_V2_ADDRESSES.poolFactory,
      functionName: 'getPool',
      args: [tokenIn, tokenOut, c.options.stable],
    })) as Address;

    if (poolAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
      return c.error({
        code: 'POOL_NOT_FOUND',
        message: `No ${c.options.stable ? 'stable' : 'volatile'} V2 pool found for pair ${checksumAddress(tokenIn)}/${checksumAddress(tokenOut)}.`,
      });
    }

    // Get quote via router
    const amounts = (await client.readContract({
      abi: v2RouterAbi,
      address: ABOREAN_V2_ADDRESSES.router,
      functionName: 'getAmountsOut',
      args: [
        amountInRaw,
        [
          {
            from: tokenIn,
            to: tokenOut,
            stable: c.options.stable,
            factory: ABOREAN_V2_ADDRESSES.poolFactory,
          },
        ],
      ],
    })) as bigint[];

    const expectedAmountOut = amounts[amounts.length - 1] ?? 0n;

    if (expectedAmountOut === 0n) {
      return c.error({
        code: 'ZERO_QUOTE',
        message: 'Router returned zero output amount. The pool may have insufficient liquidity.',
      });
    }

    // Apply slippage tolerance
    const slippageBps = Math.round(c.options.slippage * 100);
    const minAmountOut = (expectedAmountOut * BigInt(10_000 - slippageBps)) / 10_000n;
    const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + c.options.deadline);

    const account = resolveAccount(c.env);

    // Approve router to spend tokenIn (if not dry-run, we approve; if dry-run, skip approval)
    if (!c.options['dry-run']) {
      const currentAllowance = (await client.readContract({
        abi: erc20ApproveAbi,
        address: tokenIn,
        functionName: 'allowance',
        args: [account.address, ABOREAN_V2_ADDRESSES.router],
      })) as bigint;

      if (currentAllowance < amountInRaw) {
        await aboreanWriteTx({
          env: c.env,
          options: { ...c.options, 'dry-run': false },
          address: tokenIn,
          abi: erc20ApproveAbi,
          functionName: 'approve',
          args: [ABOREAN_V2_ADDRESSES.router, amountInRaw],
        });
      }
    }

    // Execute swap

    const tx = await aboreanWriteTx({
      env: c.env,
      options: c.options,
      address: ABOREAN_V2_ADDRESSES.router,
      abi: v2RouterSwapAbi,
      functionName: 'swapExactTokensForTokens',
      args: [
        amountInRaw,
        minAmountOut,
        [
          {
            from: tokenIn,
            to: tokenOut,
            stable: c.options.stable,
            factory: ABOREAN_V2_ADDRESSES.poolFactory,
          },
        ],
        account.address,
        deadlineTimestamp,
      ],
    });

    const amountInDecimal = formatUnits(amountInRaw, inMeta.decimals);
    const expectedOutDecimal = formatUnits(expectedAmountOut, outMeta.decimals);
    const minOutDecimal = formatUnits(minAmountOut, outMeta.decimals);

    const ratio = Number(expectedOutDecimal) / Number(amountInDecimal);

    return c.ok({
      pool: checksumAddress(poolAddress),
      stable: c.options.stable,
      tokenIn: inMeta,
      tokenOut: outMeta,
      amountIn: {
        raw: amountInRaw.toString(),
        decimal: amountInDecimal,
      },
      expectedAmountOut: {
        raw: expectedAmountOut.toString(),
        decimal: expectedOutDecimal,
      },
      minAmountOut: {
        raw: minAmountOut.toString(),
        decimal: minOutDecimal,
      },
      slippagePercent: c.options.slippage,
      effectivePrice: Number(amountInDecimal) === 0 ? null : finiteOrNull(ratio),
      tx,
    });
  },
});
