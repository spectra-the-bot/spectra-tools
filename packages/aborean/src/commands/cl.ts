import { checksumAddress, isAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { formatUnits, parseUnits } from 'viem';
import type { Address } from 'viem';
import {
  clFactoryAbi,
  clPoolAbi,
  nonfungiblePositionManagerAbi,
  quoterV2Abi,
  swapRouterAbi,
} from '../contracts/abis.js';
import { ABOREAN_CL_ADDRESSES } from '../contracts/addresses.js';
import { createAboreanPublicClient } from '../contracts/client.js';
import {
  type FormattedWriteDryRunResult,
  type FormattedWriteTxResult,
  aboreanWriteTx,
  resolveAccount,
  writeEnv,
  writeOptions,
} from './_write-utils.js';

const Q96 = 2n ** 96n;
const MULTICALL_BATCH_SIZE = 100;

type Slot0 = readonly [bigint, number, number, number, number, boolean];

type PoolState = {
  pool: Address;
  token0: Address;
  token1: Address;
  tickSpacing: number;
  fee: number;
  liquidity: bigint;
  slot0: Slot0;
};

type TokenMeta = {
  address: Address;
  symbol: string;
  decimals: number;
};

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

const tokenSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
});

const poolRowSchema = z.object({
  pool: z.string(),
  pair: z.string(),
  token0: tokenSchema,
  token1: tokenSchema,
  fee: z.number(),
  feePercent: z.number(),
  tickSpacing: z.number(),
  liquidity: z.string(),
  currentTick: z.number(),
  sqrtPriceX96: z.string(),
  activeLiquidityEstimate: z.object({
    token0: z.string(),
    token1: z.string(),
    totalInToken0: z.number().nullable(),
    totalInToken1: z.number().nullable(),
  }),
  price: z.object({
    token1PerToken0: z.number().nullable(),
    token0PerToken1: z.number().nullable(),
  }),
});

const quoteOutputSchema = z.object({
  pool: z.string(),
  selectedFee: z.number(),
  selectedTickSpacing: z.number(),
  tokenIn: tokenSchema,
  tokenOut: tokenSchema,
  amountIn: z.object({
    raw: z.string(),
    decimal: z.string(),
  }),
  amountOut: z.object({
    raw: z.string(),
    decimal: z.string(),
  }),
  execution: z.object({
    sqrtPriceX96After: z.string(),
    initializedTicksCrossed: z.number(),
    gasEstimate: z.string(),
  }),
  prices: z.object({
    poolMidPriceOutPerIn: z.number().nullable(),
    quotePriceOutPerIn: z.number().nullable(),
    priceImpactPct: z.number().nullable(),
  }),
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

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function toTokenMetaFallback(address: Address): TokenMeta {
  return {
    address,
    symbol: shortAddress(checksumAddress(address)),
    decimals: 18,
  };
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

async function multicallAllowFailure(
  client: ReturnType<typeof createAboreanPublicClient>,
  contracts: readonly unknown[],
) {
  const batches = chunk(contracts, MULTICALL_BATCH_SIZE);
  const out: Array<{ status: 'success'; result: unknown } | { status: 'failure'; error: unknown }> =
    [];

  for (const batch of batches) {
    const res = (await client.multicall({
      allowFailure: true,
      contracts: batch as Parameters<typeof client.multicall>[0]['contracts'],
    })) as Array<{ status: 'success'; result: unknown } | { status: 'failure'; error: unknown }>;
    out.push(...res);
  }

  return out;
}

async function multicallStrict(
  client: ReturnType<typeof createAboreanPublicClient>,
  contracts: readonly unknown[],
) {
  const batches = chunk(contracts, MULTICALL_BATCH_SIZE);
  const out: unknown[] = [];

  for (const batch of batches) {
    const res = await client.multicall({
      allowFailure: false,
      contracts: batch as Parameters<typeof client.multicall>[0]['contracts'],
    });
    out.push(...res);
  }

  return out;
}

function derivePrices(sqrtPriceX96: bigint, token0Decimals: number, token1Decimals: number) {
  const sqrtRatio = Number(sqrtPriceX96) / 2 ** 96;
  const rawPrice = sqrtRatio * sqrtRatio;
  const decimalScale = 10 ** (token0Decimals - token1Decimals);
  const token1PerToken0 = finiteOrNull(rawPrice * decimalScale);
  const token0PerToken1 =
    token1PerToken0 === null || token1PerToken0 === 0 ? null : finiteOrNull(1 / token1PerToken0);

  return {
    token1PerToken0,
    token0PerToken1,
  };
}

function estimateActiveLiquidity(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number,
  prices: { token1PerToken0: number | null; token0PerToken1: number | null },
) {
  if (sqrtPriceX96 === 0n) {
    return {
      token0: '0',
      token1: '0',
      totalInToken0: null,
      totalInToken1: null,
    };
  }

  const reserve0Raw = (liquidity * Q96) / sqrtPriceX96;
  const reserve1Raw = (liquidity * sqrtPriceX96) / Q96;

  const reserve0 = Number(formatUnits(reserve0Raw, token0Decimals));
  const reserve1 = Number(formatUnits(reserve1Raw, token1Decimals));

  const totalInToken1 =
    prices.token1PerToken0 === null
      ? null
      : finiteOrNull(reserve1 + reserve0 * prices.token1PerToken0);
  const totalInToken0 =
    prices.token0PerToken1 === null
      ? null
      : finiteOrNull(reserve0 + reserve1 * prices.token0PerToken1);

  return {
    token0: formatUnits(reserve0Raw, token0Decimals),
    token1: formatUnits(reserve1Raw, token1Decimals),
    totalInToken0,
    totalInToken1,
  };
}

async function readTokenMetadata(
  client: ReturnType<typeof createAboreanPublicClient>,
  tokenAddresses: readonly Address[],
): Promise<Map<Address, TokenMeta>> {
  const uniqueTokens = [...new Set(tokenAddresses.map((x) => x.toLowerCase()))] as Address[];

  if (uniqueTokens.length === 0) {
    return new Map();
  }

  const contracts = uniqueTokens.flatMap((address) => [
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

  const results = await multicallAllowFailure(client, contracts);
  const out = new Map<Address, TokenMeta>();

  for (let i = 0; i < uniqueTokens.length; i += 1) {
    const address = uniqueTokens[i];
    const symbolResult = results[i * 2];
    const decimalsResult = results[i * 2 + 1];

    const fallback = toTokenMetaFallback(address);

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

    out.set(address, {
      address: checksumAddress(address) as Address,
      symbol,
      decimals,
    });
  }

  return out;
}

async function listPoolAddresses(client: ReturnType<typeof createAboreanPublicClient>) {
  const count = (await client.readContract({
    abi: clFactoryAbi,
    address: ABOREAN_CL_ADDRESSES.clFactory,
    functionName: 'allPoolsLength',
  })) as bigint;

  if (count === 0n) {
    return [] as Address[];
  }

  const poolIndexContracts = Array.from({ length: Number(count) }, (_, i) => ({
    abi: clFactoryAbi,
    address: ABOREAN_CL_ADDRESSES.clFactory,
    functionName: 'allPools' as const,
    args: [BigInt(i)] as const,
  }));

  const poolAddresses = await multicallStrict(client, poolIndexContracts);
  return poolAddresses as Address[];
}

async function readPoolStates(
  client: ReturnType<typeof createAboreanPublicClient>,
  poolAddresses: readonly Address[],
) {
  if (poolAddresses.length === 0) {
    return [] as PoolState[];
  }

  const poolContracts = poolAddresses.flatMap((pool) => [
    {
      abi: clPoolAbi,
      address: pool,
      functionName: 'token0',
    },
    {
      abi: clPoolAbi,
      address: pool,
      functionName: 'token1',
    },
    {
      abi: clPoolAbi,
      address: pool,
      functionName: 'tickSpacing',
    },
    {
      abi: clPoolAbi,
      address: pool,
      functionName: 'fee',
    },
    {
      abi: clPoolAbi,
      address: pool,
      functionName: 'liquidity',
    },
    {
      abi: clPoolAbi,
      address: pool,
      functionName: 'slot0',
    },
  ]);

  const values = await multicallStrict(client, poolContracts);

  return poolAddresses.map((pool, i) => ({
    pool,
    token0: values[i * 6] as Address,
    token1: values[i * 6 + 1] as Address,
    tickSpacing: Number(values[i * 6 + 2]),
    fee: Number(values[i * 6 + 3]),
    liquidity: values[i * 6 + 4] as bigint,
    slot0: values[i * 6 + 5] as Slot0,
  }));
}

function toPoolRow(pool: PoolState, tokenMeta: Map<Address, TokenMeta>) {
  const token0 = tokenMeta.get(pool.token0) ?? toTokenMetaFallback(pool.token0);
  const token1 = tokenMeta.get(pool.token1) ?? toTokenMetaFallback(pool.token1);
  const prices = derivePrices(pool.slot0[0], token0.decimals, token1.decimals);
  const activeLiquidityEstimate = estimateActiveLiquidity(
    pool.liquidity,
    pool.slot0[0],
    token0.decimals,
    token1.decimals,
    prices,
  );

  return {
    pool: checksumAddress(pool.pool),
    pair: `${token0.symbol}/${token1.symbol}`,
    token0,
    token1,
    fee: pool.fee,
    feePercent: pool.fee / 10_000,
    tickSpacing: pool.tickSpacing,
    liquidity: pool.liquidity.toString(),
    currentTick: pool.slot0[1],
    sqrtPriceX96: pool.slot0[0].toString(),
    activeLiquidityEstimate,
    price: prices,
  };
}

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

export const cl = Cli.create('cl', {
  description: 'Concentrated liquidity (Slipstream) pools, positions, and quotes.',
});

cl.command('pools', {
  description: 'List Slipstream pools with current state, prices, and active liquidity estimate.',
  env,
  output: z.object({
    count: z.number(),
    pools: z.array(poolRowSchema),
  }),
  async run(c) {
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const pools = await listPoolAddresses(client);
    const poolStates = await readPoolStates(client, pools);
    const tokenMeta = await readTokenMetadata(
      client,
      poolStates.flatMap((pool) => [pool.token0, pool.token1]),
    );

    const rows = poolStates.map((pool) => toPoolRow(pool, tokenMeta));

    const firstPool = rows[0];

    return c.ok(
      {
        count: rows.length,
        pools: rows,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Explore CL pools:',
              commands: [
                ...(firstPool
                  ? [
                      {
                        command: 'cl pool' as const,
                        args: { pool: firstPool.pool },
                        description: `Inspect ${firstPool.pair}`,
                      },
                    ]
                  : []),
                {
                  command: 'cl positions' as const,
                  args: { owner: '<address>' },
                  description: 'List CL positions for an address',
                },
              ],
            },
          },
    );
  },
});

cl.command('pool', {
  description: 'Get detailed state for a Slipstream pool address.',
  args: z.object({
    pool: z.string().describe('Pool address'),
  }),
  env,
  output: z.object({
    pool: poolRowSchema,
  }),
  async run(c) {
    if (!isAddress(c.args.pool)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid pool address: "${c.args.pool}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }

    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const checksummedPool = checksumAddress(c.args.pool) as Address;
    const [poolState] = await readPoolStates(client, [checksummedPool]);
    const tokenMeta = await readTokenMetadata(client, [poolState.token0, poolState.token1]);

    const row = toPoolRow(poolState, tokenMeta);

    return c.ok(
      {
        pool: row,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Next steps:',
              commands: [
                {
                  command: 'cl quote' as const,
                  args: {
                    tokenIn: row.token0.address,
                    tokenOut: row.token1.address,
                    amountIn: '1',
                  },
                  description: `Quote a ${row.token0.symbol} → ${row.token1.symbol} swap`,
                },
                {
                  command: 'cl positions' as const,
                  args: { owner: '<address>' },
                  description: 'List positions in this pool',
                },
              ],
            },
          },
    );
  },
});

cl.command('positions', {
  description: 'List concentrated liquidity NFT positions for an owner.',
  args: z.object({
    owner: z.string().describe('Owner wallet address'),
  }),
  env,
  output: z.object({
    owner: z.string(),
    count: z.number(),
    positions: z.array(
      z.object({
        tokenId: z.string(),
        pair: z.string(),
        token0: tokenSchema,
        token1: tokenSchema,
        tickSpacing: z.number(),
        tickLower: z.number(),
        tickUpper: z.number(),
        liquidity: z.string(),
        tokensOwed0: z.object({ raw: z.string(), decimal: z.string() }),
        tokensOwed1: z.object({ raw: z.string(), decimal: z.string() }),
      }),
    ),
  }),
  async run(c) {
    if (!isAddress(c.args.owner)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid owner address: "${c.args.owner}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }

    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const owner = checksumAddress(c.args.owner) as Address;

    const balance = (await client.readContract({
      abi: nonfungiblePositionManagerAbi,
      address: ABOREAN_CL_ADDRESSES.nonfungiblePositionManager,
      functionName: 'balanceOf',
      args: [owner],
    })) as bigint;

    if (balance === 0n) {
      return c.ok({ owner, count: 0, positions: [] });
    }

    const tokenIdContracts = Array.from({ length: Number(balance) }, (_, i) => ({
      abi: nonfungiblePositionManagerAbi,
      address: ABOREAN_CL_ADDRESSES.nonfungiblePositionManager,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [owner, BigInt(i)] as const,
    }));

    const tokenIds = (await multicallStrict(client, tokenIdContracts)) as bigint[];

    const positionContracts = tokenIds.map((tokenId) => ({
      abi: nonfungiblePositionManagerAbi,
      address: ABOREAN_CL_ADDRESSES.nonfungiblePositionManager,
      functionName: 'positions' as const,
      args: [tokenId] as const,
    }));

    const positionsRaw = (await multicallStrict(client, positionContracts)) as Array<
      readonly [
        bigint,
        Address,
        Address,
        Address,
        number,
        number,
        number,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
      ]
    >;

    const tokenMeta = await readTokenMetadata(
      client,
      positionsRaw.flatMap((position) => [position[2], position[3]]),
    );

    const positions = tokenIds.map((tokenId, i) => {
      const position = positionsRaw[i];
      const token0 = tokenMeta.get(position[2]) ?? toTokenMetaFallback(position[2]);
      const token1 = tokenMeta.get(position[3]) ?? toTokenMetaFallback(position[3]);

      return {
        tokenId: tokenId.toString(),
        pair: `${token0.symbol}/${token1.symbol}`,
        token0,
        token1,
        tickSpacing: position[4],
        tickLower: position[5],
        tickUpper: position[6],
        liquidity: position[7].toString(),
        tokensOwed0: {
          raw: position[10].toString(),
          decimal: formatUnits(position[10], token0.decimals),
        },
        tokensOwed1: {
          raw: position[11].toString(),
          decimal: formatUnits(position[11], token1.decimals),
        },
      };
    });

    const firstPosition = positions[0];

    return c.ok(
      {
        owner,
        count: positions.length,
        positions,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: firstPosition
                ? [
                    {
                      command: 'cl pool' as const,
                      args: { pool: '<poolAddress>' },
                      description: `Inspect pool for ${firstPosition.pair}`,
                    },
                    {
                      command: 'cl quote' as const,
                      args: {
                        tokenIn: firstPosition.token0.address,
                        tokenOut: firstPosition.token1.address,
                        amountIn: '1',
                      },
                      description: `Quote a ${firstPosition.token0.symbol} → ${firstPosition.token1.symbol} swap`,
                    },
                  ]
                : [],
            },
          },
    );
  },
});

cl.command('quote', {
  description: 'Quote a single-hop Slipstream swap via QuoterV2.',
  args: z.object({
    tokenIn: z.string().describe('Input token address'),
    tokenOut: z.string().describe('Output token address'),
    amountIn: z.string().describe('Input amount in human-readable decimal units'),
  }),
  options: z.object({
    fee: z.coerce.number().int().positive().optional().describe('Optional fee tier filter'),
  }),
  env,
  output: quoteOutputSchema,
  async run(c) {
    const { tokenIn, tokenOut, amountIn } = c.args;

    if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: 'tokenIn and tokenOut must both be valid 0x-prefixed 20-byte addresses.',
      });
    }

    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const inAddress = checksumAddress(tokenIn) as Address;
    const outAddress = checksumAddress(tokenOut) as Address;

    const allPools = await listPoolAddresses(client);
    const poolStates = await readPoolStates(client, allPools);

    const pairPools = poolStates.filter((pool) => {
      const a = normalizeAddress(pool.token0);
      const b = normalizeAddress(pool.token1);
      const tokenInNorm = normalizeAddress(inAddress);
      const tokenOutNorm = normalizeAddress(outAddress);

      return (a === tokenInNorm && b === tokenOutNorm) || (a === tokenOutNorm && b === tokenInNorm);
    });

    const filteredPools =
      typeof c.options.fee === 'number'
        ? pairPools.filter((pool) => pool.fee === c.options.fee)
        : pairPools;

    if (filteredPools.length === 0) {
      return c.error({
        code: 'POOL_NOT_FOUND',
        message:
          typeof c.options.fee === 'number'
            ? `No Slipstream pool found for pair ${inAddress}/${outAddress} at fee tier ${c.options.fee}.`
            : `No Slipstream pool found for pair ${inAddress}/${outAddress}.`,
      });
    }

    const selectedPool = [...filteredPools].sort((a, b) => {
      if (a.liquidity === b.liquidity) return 0;
      return a.liquidity > b.liquidity ? -1 : 1;
    })[0];

    const tokenMeta = await readTokenMetadata(client, [inAddress, outAddress]);
    const inMeta = tokenMeta.get(inAddress) ?? toTokenMetaFallback(inAddress);
    const outMeta = tokenMeta.get(outAddress) ?? toTokenMetaFallback(outAddress);

    let amountInRaw: bigint;
    try {
      amountInRaw = parseUnits(amountIn, inMeta.decimals);
    } catch {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: `Invalid amountIn: "${amountIn}" for token ${inMeta.symbol} (${inMeta.decimals} decimals).`,
      });
    }

    const quote = (await client.readContract({
      abi: quoterV2Abi,
      address: ABOREAN_CL_ADDRESSES.quoterV2,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          tokenIn: inAddress,
          tokenOut: outAddress,
          amountIn: amountInRaw,
          tickSpacing: selectedPool.tickSpacing,
          sqrtPriceLimitX96: 0n,
        },
      ],
    })) as readonly [bigint, bigint, number, bigint];

    const amountOutRaw = quote[0];
    const amountOutDecimal = formatUnits(amountOutRaw, outMeta.decimals);
    const amountInDecimal = formatUnits(amountInRaw, inMeta.decimals);

    const quotePriceOutPerIn =
      Number(amountInDecimal) === 0
        ? null
        : finiteOrNull(Number(amountOutDecimal) / Number(amountInDecimal));

    const poolTokenMeta = await readTokenMetadata(client, [
      selectedPool.token0,
      selectedPool.token1,
    ]);
    const poolToken0Meta =
      poolTokenMeta.get(selectedPool.token0) ?? toTokenMetaFallback(selectedPool.token0);
    const poolToken1Meta =
      poolTokenMeta.get(selectedPool.token1) ?? toTokenMetaFallback(selectedPool.token1);
    const poolPrices = derivePrices(
      selectedPool.slot0[0],
      poolToken0Meta.decimals,
      poolToken1Meta.decimals,
    );

    const inIsToken0 = normalizeAddress(inAddress) === normalizeAddress(selectedPool.token0);
    const poolMidPriceOutPerIn = inIsToken0
      ? poolPrices.token1PerToken0
      : poolPrices.token0PerToken1;

    const priceImpactPct =
      quotePriceOutPerIn === null || poolMidPriceOutPerIn === null || poolMidPriceOutPerIn === 0
        ? null
        : finiteOrNull(((poolMidPriceOutPerIn - quotePriceOutPerIn) / poolMidPriceOutPerIn) * 100);

    return c.ok(
      {
        pool: checksumAddress(selectedPool.pool),
        selectedFee: selectedPool.fee,
        selectedTickSpacing: selectedPool.tickSpacing,
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
        execution: {
          sqrtPriceX96After: quote[1].toString(),
          initializedTicksCrossed: quote[2],
          gasEstimate: quote[3].toString(),
        },
        prices: {
          poolMidPriceOutPerIn,
          quotePriceOutPerIn,
          priceImpactPct,
        },
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Related commands:',
              commands: [
                {
                  command: 'cl pool' as const,
                  args: { pool: checksumAddress(selectedPool.pool) },
                  description: 'Inspect the pool used for this quote',
                },
                {
                  command: 'cl quote' as const,
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

const DEFAULT_SLIPPAGE_PERCENT = 0.5;
const DEFAULT_DEADLINE_SECONDS = 300;

const swapOutputSchema = z.object({
  pool: z.string(),
  tokenIn: tokenSchema,
  tokenOut: tokenSchema,
  amountIn: z.object({ raw: z.string(), decimal: z.string() }),
  quotedAmountOut: z.object({ raw: z.string(), decimal: z.string() }),
  amountOutMinimum: z.object({ raw: z.string(), decimal: z.string() }),
  slippagePercent: z.number(),
  deadlineSeconds: z.number(),
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
});

cl.command('swap', {
  description: 'Execute a single-hop Slipstream swap via the CL SwapRouter.',
  options: z.object({
    'token-in': z.string().describe('Input token address'),
    'token-out': z.string().describe('Output token address'),
    'amount-in': z.string().describe('Input amount in wei'),
    slippage: z.coerce
      .number()
      .default(DEFAULT_SLIPPAGE_PERCENT)
      .describe('Slippage tolerance in percent (default: 0.5)'),
    deadline: z.coerce
      .number()
      .int()
      .default(DEFAULT_DEADLINE_SECONDS)
      .describe('Transaction deadline in seconds from now (default: 300)'),
    ...writeOptions.shape,
  }),
  env: writeEnv,
  output: swapOutputSchema,
  async run(c) {
    const tokenIn = c.options['token-in'];
    const tokenOut = c.options['token-out'];
    const amountInWei = c.options['amount-in'];
    const slippage = c.options.slippage;
    const deadlineSeconds = c.options.deadline;

    if (!isAddress(tokenIn) || !isAddress(tokenOut)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: 'token-in and token-out must both be valid 0x-prefixed 20-byte addresses.',
      });
    }

    const inAddress = checksumAddress(tokenIn) as Address;
    const outAddress = checksumAddress(tokenOut) as Address;

    let amountInRaw: bigint;
    try {
      amountInRaw = BigInt(amountInWei);
    } catch {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: `Invalid amount-in: "${amountInWei}". Provide a valid integer in wei.`,
      });
    }

    if (amountInRaw <= 0n) {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: 'amount-in must be a positive integer.',
      });
    }

    if (slippage < 0 || slippage > 100) {
      return c.error({
        code: 'INVALID_SLIPPAGE',
        message: `Slippage must be between 0 and 100. Got: ${slippage}`,
      });
    }

    // 1. Discover the best pool for this pair
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const allPools = await listPoolAddresses(client);
    const poolStates = await readPoolStates(client, allPools);

    const pairPools = poolStates.filter((pool) => {
      const a = normalizeAddress(pool.token0);
      const b = normalizeAddress(pool.token1);
      const tokenInNorm = normalizeAddress(inAddress);
      const tokenOutNorm = normalizeAddress(outAddress);

      return (a === tokenInNorm && b === tokenOutNorm) || (a === tokenOutNorm && b === tokenInNorm);
    });

    if (pairPools.length === 0) {
      return c.error({
        code: 'POOL_NOT_FOUND',
        message: `No Slipstream pool found for pair ${inAddress}/${outAddress}.`,
      });
    }

    const selectedPool = [...pairPools].sort((a, b) => {
      if (a.liquidity === b.liquidity) return 0;
      return a.liquidity > b.liquidity ? -1 : 1;
    })[0];

    // 2. Get token metadata
    const tokenMeta = await readTokenMetadata(client, [inAddress, outAddress]);
    const inMeta = tokenMeta.get(inAddress) ?? toTokenMetaFallback(inAddress);
    const outMeta = tokenMeta.get(outAddress) ?? toTokenMetaFallback(outAddress);

    // 3. Quote via QuoterV2 to get expected output
    const quote = (await client.readContract({
      abi: quoterV2Abi,
      address: ABOREAN_CL_ADDRESSES.quoterV2,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          tokenIn: inAddress,
          tokenOut: outAddress,
          amountIn: amountInRaw,
          tickSpacing: selectedPool.tickSpacing,
          sqrtPriceLimitX96: 0n,
        },
      ],
    })) as readonly [bigint, bigint, number, bigint];

    const quotedAmountOut = quote[0];

    // 4. Compute minimum output with slippage tolerance
    const slippageBps = BigInt(Math.round(slippage * 100));
    const amountOutMinimum = quotedAmountOut - (quotedAmountOut * slippageBps) / 10000n;

    // 5. Resolve sender account and compute deadline
    const account = resolveAccount(c.env);
    const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

    // 6. Execute the swap via aboreanWriteTx
    const txResult = await aboreanWriteTx({
      env: c.env,
      options: {
        'dry-run': c.options['dry-run'],
        'gas-limit': c.options['gas-limit'],
        'max-fee': c.options['max-fee'],
        nonce: c.options.nonce,
      },
      address: ABOREAN_CL_ADDRESSES.swapRouter as Address,
      abi: swapRouterAbi,
      functionName: 'exactInputSingle',
      args: [
        {
          tokenIn: inAddress,
          tokenOut: outAddress,
          tickSpacing: selectedPool.tickSpacing,
          recipient: account.address,
          deadline: deadlineTimestamp,
          amountIn: amountInRaw,
          amountOutMinimum,
          sqrtPriceLimitX96: 0n,
        },
      ],
    });

    const amountInDecimal = formatUnits(amountInRaw, inMeta.decimals);
    const quotedOutDecimal = formatUnits(quotedAmountOut, outMeta.decimals);
    const minOutDecimal = formatUnits(amountOutMinimum, outMeta.decimals);

    return c.ok({
      pool: checksumAddress(selectedPool.pool),
      tokenIn: inMeta,
      tokenOut: outMeta,
      amountIn: { raw: amountInRaw.toString(), decimal: amountInDecimal },
      quotedAmountOut: { raw: quotedAmountOut.toString(), decimal: quotedOutDecimal },
      amountOutMinimum: { raw: amountOutMinimum.toString(), decimal: minOutDecimal },
      slippagePercent: slippage,
      deadlineSeconds,
      tx: txResult as FormattedWriteTxResult | FormattedWriteDryRunResult,
    });
  },
});

// ---------------------------------------------------------------------------
// NonfungiblePositionManager ABI fragments for position operations
// ---------------------------------------------------------------------------

const nfpmMintAbi = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'token0', type: 'address' },
          { name: 'token1', type: 'address' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'amount0Desired', type: 'uint256' },
          { name: 'amount1Desired', type: 'uint256' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'deadline', type: 'uint256' },
          { name: 'sqrtPriceX96', type: 'uint160' },
        ],
      },
    ],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
] as const;

const nfpmDecreaseLiquidityAbi = [
  {
    type: 'function',
    name: 'decreaseLiquidity',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'liquidity', type: 'uint128' },
          { name: 'amount0Min', type: 'uint256' },
          { name: 'amount1Min', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
    ],
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
] as const;

const nfpmCollectAbi = [
  {
    type: 'function',
    name: 'collect',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenId', type: 'uint256' },
          { name: 'recipient', type: 'address' },
          { name: 'amount0Max', type: 'uint128' },
          { name: 'amount1Max', type: 'uint128' },
        ],
      },
    ],
    outputs: [
      { name: 'amount0', type: 'uint256' },
      { name: 'amount1', type: 'uint256' },
    ],
  },
] as const;

const nfpmBurnAbi = [
  {
    type: 'function',
    name: 'burn',
    stateMutability: 'payable',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [],
  },
] as const;

const erc20ApproveAbi = [
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
] as const;

const amountSchema = z.object({
  raw: z.string(),
  decimal: z.string(),
});

// ---------------------------------------------------------------------------
// cl add-position
// ---------------------------------------------------------------------------

cl.command('add-position', {
  description:
    'Mint a new concentrated liquidity position via the NonfungiblePositionManager. Approves both tokens if needed. Supports --dry-run.',
  options: z.object({
    'token-a': z.string().describe('First token address'),
    'token-b': z.string().describe('Second token address'),
    'tick-spacing': z.coerce.number().int().describe('Pool tick spacing'),
    'tick-lower': z.coerce.number().int().describe('Lower tick boundary'),
    'tick-upper': z.coerce.number().int().describe('Upper tick boundary'),
    'amount-0': z.string().describe('Desired amount of token0 in wei'),
    'amount-1': z.string().describe('Desired amount of token1 in wei'),
    slippage: z.coerce
      .number()
      .default(0.5)
      .describe('Slippage tolerance in percent (default: 0.5)'),
    deadline: z.coerce
      .number()
      .int()
      .default(300)
      .describe('Transaction deadline in seconds from now (default: 300)'),
    ...writeOptions.shape,
  }),
  env: writeEnv,
  output: z.object({
    pool: z.string(),
    token0: tokenSchema,
    token1: tokenSchema,
    tickSpacing: z.number(),
    tickLower: z.number(),
    tickUpper: z.number(),
    amount0Desired: amountSchema,
    amount1Desired: amountSchema,
    amount0Min: amountSchema,
    amount1Min: amountSchema,
    slippagePercent: z.number(),
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
    const tokenARaw = c.options['token-a'];
    const tokenBRaw = c.options['token-b'];

    if (!isAddress(tokenARaw) || !isAddress(tokenBRaw)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: 'token-a and token-b must both be valid 0x-prefixed 20-byte addresses.',
      });
    }

    // Sort tokens: token0 < token1 (by address)
    const addrA = checksumAddress(tokenARaw) as Address;
    const addrB = checksumAddress(tokenBRaw) as Address;
    const [token0, token1] =
      addrA.toLowerCase() < addrB.toLowerCase() ? [addrA, addrB] : [addrB, addrA];

    let amount0Desired: bigint;
    let amount1Desired: bigint;
    try {
      // Map amounts based on token order
      const amountForA = BigInt(c.options['amount-0']);
      const amountForB = BigInt(c.options['amount-1']);
      if (addrA.toLowerCase() < addrB.toLowerCase()) {
        amount0Desired = amountForA;
        amount1Desired = amountForB;
      } else {
        amount0Desired = amountForB;
        amount1Desired = amountForA;
      }
    } catch {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: 'amount-0 and amount-1 must be valid integers in wei.',
      });
    }

    if (amount0Desired <= 0n && amount1Desired <= 0n) {
      return c.error({
        code: 'INVALID_AMOUNT',
        message: 'At least one of amount-0 or amount-1 must be positive.',
      });
    }

    // Verify pool exists
    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const allPools = await listPoolAddresses(client);
    const poolStates = await readPoolStates(client, allPools);

    const matchingPool = poolStates.find(
      (pool) =>
        normalizeAddress(pool.token0) === normalizeAddress(token0) &&
        normalizeAddress(pool.token1) === normalizeAddress(token1) &&
        pool.tickSpacing === c.options['tick-spacing'],
    );

    if (!matchingPool) {
      return c.error({
        code: 'POOL_NOT_FOUND',
        message: `No Slipstream pool found for ${checksumAddress(token0)}/${checksumAddress(token1)} with tick spacing ${c.options['tick-spacing']}.`,
      });
    }

    // Fetch token metadata
    const tokenMeta = await readTokenMetadata(client, [token0, token1]);
    const meta0 = tokenMeta.get(token0) ?? toTokenMetaFallback(token0);
    const meta1 = tokenMeta.get(token1) ?? toTokenMetaFallback(token1);

    // Compute min amounts from slippage
    const slippageBps = BigInt(Math.round(c.options.slippage * 100));
    const amount0Min = amount0Desired - (amount0Desired * slippageBps) / 10000n;
    const amount1Min = amount1Desired - (amount1Desired * slippageBps) / 10000n;

    const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + c.options.deadline);
    const account = resolveAccount(c.env);
    const nfpmAddress = ABOREAN_CL_ADDRESSES.nonfungiblePositionManager as Address;

    // Approve both tokens if needed (skip in dry-run)
    if (!c.options['dry-run']) {
      for (const [token, amount] of [
        [token0, amount0Desired],
        [token1, amount1Desired],
      ] as const) {
        if (amount <= 0n) continue;
        const currentAllowance = (await client.readContract({
          abi: erc20ApproveAbi,
          address: token,
          functionName: 'allowance',
          args: [account.address, nfpmAddress],
        })) as bigint;

        if (currentAllowance < amount) {
          await aboreanWriteTx({
            env: c.env,
            options: { ...c.options, 'dry-run': false },
            address: token,
            abi: erc20ApproveAbi as unknown as import('viem').Abi,
            functionName: 'approve',
            args: [nfpmAddress, amount],
          });
        }
      }
    }

    // Execute mint
    const txResult = await aboreanWriteTx({
      env: c.env,
      options: {
        'dry-run': c.options['dry-run'],
        'gas-limit': c.options['gas-limit'],
        'max-fee': c.options['max-fee'],
        nonce: c.options.nonce,
      },
      address: nfpmAddress,
      abi: nfpmMintAbi as unknown as import('viem').Abi,
      functionName: 'mint',
      args: [
        {
          token0,
          token1,
          tickSpacing: c.options['tick-spacing'],
          tickLower: c.options['tick-lower'],
          tickUpper: c.options['tick-upper'],
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          recipient: account.address,
          deadline: deadlineTimestamp,
          sqrtPriceX96: 0n,
        },
      ],
    });

    return c.ok({
      pool: checksumAddress(matchingPool.pool),
      token0: meta0,
      token1: meta1,
      tickSpacing: c.options['tick-spacing'],
      tickLower: c.options['tick-lower'],
      tickUpper: c.options['tick-upper'],
      amount0Desired: {
        raw: amount0Desired.toString(),
        decimal: formatUnits(amount0Desired, meta0.decimals),
      },
      amount1Desired: {
        raw: amount1Desired.toString(),
        decimal: formatUnits(amount1Desired, meta1.decimals),
      },
      amount0Min: {
        raw: amount0Min.toString(),
        decimal: formatUnits(amount0Min, meta0.decimals),
      },
      amount1Min: {
        raw: amount1Min.toString(),
        decimal: formatUnits(amount1Min, meta1.decimals),
      },
      slippagePercent: c.options.slippage,
      tx: txResult as FormattedWriteTxResult | FormattedWriteDryRunResult,
    });
  },
});

// ---------------------------------------------------------------------------
// cl remove-position
// ---------------------------------------------------------------------------

cl.command('remove-position', {
  description:
    'Remove (close) a concentrated liquidity position. Decreases liquidity to zero, collects all tokens, and burns the NFT. Supports --dry-run.',
  options: z.object({
    'token-id': z.string().describe('Position NFT token ID'),
    slippage: z.coerce
      .number()
      .default(0.5)
      .describe('Slippage tolerance in percent (default: 0.5)'),
    deadline: z.coerce
      .number()
      .int()
      .default(300)
      .describe('Transaction deadline in seconds from now (default: 300)'),
    ...writeOptions.shape,
  }),
  env: writeEnv,
  output: z.object({
    tokenId: z.string(),
    pair: z.string(),
    token0: tokenSchema,
    token1: tokenSchema,
    tickLower: z.number(),
    tickUpper: z.number(),
    liquidity: z.string(),
    slippagePercent: z.number(),
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
    let tokenId: bigint;
    try {
      tokenId = BigInt(c.options['token-id']);
    } catch {
      return c.error({
        code: 'INVALID_TOKEN_ID',
        message: `Invalid token-id: "${c.options['token-id']}". Provide a valid integer.`,
      });
    }

    if (tokenId <= 0n) {
      return c.error({
        code: 'INVALID_TOKEN_ID',
        message: 'token-id must be a positive integer.',
      });
    }

    const client = createAboreanPublicClient(c.env.ABSTRACT_RPC_URL);
    const nfpmAddress = ABOREAN_CL_ADDRESSES.nonfungiblePositionManager as Address;

    // Read position data
    let positionData: readonly [
      bigint,
      Address,
      Address,
      Address,
      number,
      number,
      number,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];
    try {
      positionData = (await client.readContract({
        abi: nonfungiblePositionManagerAbi,
        address: nfpmAddress,
        functionName: 'positions',
        args: [tokenId],
      })) as typeof positionData;
    } catch {
      return c.error({
        code: 'POSITION_NOT_FOUND',
        message: `Position with tokenId ${tokenId.toString()} not found.`,
      });
    }

    const token0 = positionData[2];
    const token1 = positionData[3];
    const tickLower = positionData[5];
    const tickUpper = positionData[6];
    const liquidity = positionData[7];

    if (liquidity === 0n) {
      return c.error({
        code: 'ZERO_LIQUIDITY',
        message: `Position ${tokenId.toString()} has zero liquidity. Nothing to remove.`,
      });
    }

    // Fetch token metadata
    const tokenMeta = await readTokenMetadata(client, [token0, token1]);
    const meta0 = tokenMeta.get(token0) ?? toTokenMetaFallback(token0);
    const meta1 = tokenMeta.get(token1) ?? toTokenMetaFallback(token1);

    const account = resolveAccount(c.env);
    const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + c.options.deadline);

    // Step 1: decreaseLiquidity to zero
    const txResult = await aboreanWriteTx({
      env: c.env,
      options: {
        'dry-run': c.options['dry-run'],
        'gas-limit': c.options['gas-limit'],
        'max-fee': c.options['max-fee'],
        nonce: c.options.nonce,
      },
      address: nfpmAddress,
      abi: nfpmDecreaseLiquidityAbi as unknown as import('viem').Abi,
      functionName: 'decreaseLiquidity',
      args: [
        {
          tokenId,
          liquidity,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: deadlineTimestamp,
        },
      ],
    });

    // Step 2 & 3: collect and burn (skip if dry-run)
    if (!c.options['dry-run']) {
      const maxUint128 = (1n << 128n) - 1n;

      await aboreanWriteTx({
        env: c.env,
        options: { ...c.options, 'dry-run': false },
        address: nfpmAddress,
        abi: nfpmCollectAbi as unknown as import('viem').Abi,
        functionName: 'collect',
        args: [
          {
            tokenId,
            recipient: account.address,
            amount0Max: maxUint128,
            amount1Max: maxUint128,
          },
        ],
      });

      await aboreanWriteTx({
        env: c.env,
        options: { ...c.options, 'dry-run': false },
        address: nfpmAddress,
        abi: nfpmBurnAbi as unknown as import('viem').Abi,
        functionName: 'burn',
        args: [tokenId],
      });
    }

    return c.ok({
      tokenId: tokenId.toString(),
      pair: `${meta0.symbol}/${meta1.symbol}`,
      token0: meta0,
      token1: meta1,
      tickLower,
      tickUpper,
      liquidity: liquidity.toString(),
      slippagePercent: c.options.slippage,
      tx: txResult as FormattedWriteTxResult | FormattedWriteDryRunResult,
    });
  },
});
