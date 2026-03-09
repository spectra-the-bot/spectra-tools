import { checksumAddress, isAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { formatUnits, parseUnits } from 'viem';
import type { Address } from 'viem';
import {
  clFactoryAbi,
  clPoolAbi,
  nonfungiblePositionManagerAbi,
  quoterV2Abi,
} from '../contracts/abis.js';
import { ABOREAN_CL_ADDRESSES } from '../contracts/addresses.js';
import { createAboreanPublicClient } from '../contracts/client.js';

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

    return c.ok({
      count: rows.length,
      pools: rows,
    });
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

    return c.ok({
      pool: toPoolRow(poolState, tokenMeta),
    });
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

    return c.ok({
      owner,
      count: positions.length,
      positions,
    });
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

    return c.ok({
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
    });
  },
});
