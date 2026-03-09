import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Envelope = {
  ok: boolean;
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const mockClient = {
  readContract: vi.fn(),
  multicall: vi.fn(),
  getBalance: vi.fn(),
  getBlock: vi.fn(),
  getBlockNumber: vi.fn(),
  getContractEvents: vi.fn(),
};

vi.mock('../contracts/client.js', () => ({
  createAboreanPublicClient: () => mockClient,
}));

async function run(argv: string[]) {
  const { cli } = await import('../cli.js');
  const lines: string[] = [];
  await cli.serve([...argv, '--format', 'json', '--verbose'], {
    stdout: (line) => lines.push(line),
    exit: () => undefined,
  });
  const json = [...lines].reverse().find((x) => x.trim().startsWith('{')) ?? '{}';
  return JSON.parse(json) as Envelope;
}

function createViemError(options: { message: string; name: string; shortMessage: string }) {
  const error = new Error(options.message) as Error & { shortMessage?: string };
  error.name = options.name;
  error.shortMessage = options.shortMessage;
  return error;
}

describe('aborean CLI', () => {
  const poolA = '0x1000000000000000000000000000000000000001';
  const poolB = '0x1000000000000000000000000000000000000002';
  const poolC = '0x1000000000000000000000000000000000000003';
  const tokenA = '0x2000000000000000000000000000000000000001';
  const tokenB = '0x2000000000000000000000000000000000000002';
  const tokenC = '0x2000000000000000000000000000000000000003';

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('status returns protocol snapshot', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(42n)
      .mockResolvedValueOnce(15n)
      .mockResolvedValueOnce(30n)
      .mockResolvedValueOnce(1000000000000000000000n)
      .mockResolvedValueOnce(5000000000000000000000n)
      .mockResolvedValueOnce(4000000000000000000000n);

    const out = await run(['status']);

    expect(out.ok).toBe(true);
    expect(mockClient.readContract).toHaveBeenCalledTimes(6);

    const data = out.data as Record<string, unknown>;
    expect(data.v2PoolCount).toBe(42);
    expect(data.clPoolCount).toBe(15);
    expect(data.gaugeCount).toBe(30);
    expect(data.totalVotingWeight).toBe('1000000000000000000000');
    expect(data.veABXTotalSupply).toBe('5000000000000000000000');
    expect(data.veABXLockedSupply).toBe('4000000000000000000000');
  });

  it('gauges list returns batched gauge data', async () => {
    const poolA = '0x0000000000000000000000000000000000000011';
    const poolB = '0x0000000000000000000000000000000000000022';
    const gaugeA = '0x00000000000000000000000000000000000000A1';
    const rewardToken = '0x00000000000000000000000000000000000000B1';

    mockClient.readContract
      .mockResolvedValueOnce(1n) // v2 allPoolsLength
      .mockResolvedValueOnce(1n); // cl allPoolsLength

    mockClient.multicall
      .mockResolvedValueOnce([poolA]) // v2 pools
      .mockResolvedValueOnce([poolB]) // cl pools
      .mockResolvedValueOnce([gaugeA, ZERO_ADDRESS]) // voter.gauges(pool)
      .mockResolvedValueOnce([rewardToken, 123456n, 987654n, 2000000000n, 1234n]); // details for active gauge

    const out = await run(['gauges', 'list']);

    expect(out.ok).toBe(true);
    expect(mockClient.multicall).toHaveBeenCalledTimes(4);

    const data = out.data as {
      gauges: Array<Record<string, unknown>>;
      count: number;
    };

    expect(data.count).toBe(1);
    expect(data.gauges[0]).toMatchObject({
      pool: poolA,
      gauge: gaugeA,
      rewardToken,
      rewardRate: '123456',
      totalStaked: '987654',
      claimableEmissions: '1234',
      periodFinish: 2000000000,
    });
  });

  it('gauges info returns detailed state', async () => {
    const gauge = '0x00000000000000000000000000000000000000A1';
    const pool = '0x0000000000000000000000000000000000000011';

    mockClient.readContract
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce('0x00000000000000000000000000000000000000B2')
      .mockResolvedValueOnce('0x00000000000000000000000000000000000000B3')
      .mockResolvedValueOnce('0x00000000000000000000000000000000000000C1')
      .mockResolvedValueOnce('0x00000000000000000000000000000000000000C2')
      .mockResolvedValueOnce(5000n)
      .mockResolvedValueOnce(25n)
      .mockResolvedValueOnce(2000000000n)
      .mockResolvedValueOnce(1999990000n)
      .mockResolvedValueOnce(101n)
      .mockResolvedValueOnce(55n)
      .mockResolvedValueOnce(66n)
      .mockResolvedValueOnce(44n);

    const out = await run(['gauges', 'info', gauge]);

    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data.gauge).toBe(gauge);
    expect(data.pool).toBe(pool);
    expect(data.isAlive).toBe(true);
    expect(data.totalStaked).toBe('5000');
    expect(data.rewardRate).toBe('25');
  });

  it('ve stats and locks work with multicall batching', async () => {
    mockClient.readContract
      .mockResolvedValueOnce('0x00000000000000000000000000000000000000D1') // token
      .mockResolvedValueOnce(1000n) // totalSupply
      .mockResolvedValueOnce(800n) // supply
      .mockResolvedValueOnce(120n) // permanentLockBalance
      .mockResolvedValueOnce(3n) // epoch
      .mockResolvedValueOnce({
        bias: 9n,
        slope: 2n,
        ts: 1900000000n,
        blk: 12345678n,
        permanentLockBalance: 120n,
      }); // pointHistory(epoch)

    const statsOut = await run(['ve', 'stats']);

    expect(statsOut.ok).toBe(true);
    const stats = statsOut.data as Record<string, unknown>;
    expect(stats.totalVotingPower).toBe('1000');
    expect(stats.totalLocked).toBe('800');
    expect(stats.decaySlope).toBe('2');

    mockClient.readContract.mockResolvedValueOnce(2n); // balanceOf(owner)
    mockClient.multicall
      .mockResolvedValueOnce([11n, 12n]) // tokenOfOwnerByIndex
      .mockResolvedValueOnce([
        { amount: 100n, end: 2000000000n, isPermanent: false },
        90n,
        { amount: 300n, end: 2100000000n, isPermanent: true },
        310n,
      ]); // locked + balanceOfNFT

    const locksOut = await run(['ve', 'locks', '0x00000000000000000000000000000000000000E1']);

    expect(locksOut.ok).toBe(true);
    expect(mockClient.multicall).toHaveBeenCalledTimes(2);

    const locksData = locksOut.data as {
      count: number;
      locks: Array<Record<string, unknown>>;
    };
    expect(locksData.count).toBe(2);
    expect(locksData.locks[0]).toMatchObject({
      tokenId: '11',
      amount: '100',
      votingPower: '90',
    });
  });

  it('voter epoch and weights return expected fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T23:00:00Z'));

    mockClient.readContract
      .mockResolvedValueOnce(1900000000n) // activePeriod
      .mockResolvedValueOnce(604800n) // WEEK
      .mockResolvedValueOnce(50n) // epochCount
      .mockResolvedValueOnce(123000000000000000000n); // weekly

    const epochOut = await run(['voter', 'epoch']);

    expect(epochOut.ok).toBe(true);
    const epochData = epochOut.data as Record<string, unknown>;
    expect(epochData.activePeriod).toBe(1900000000);
    expect(epochData.weekSeconds).toBe(604800);
    expect(epochData.weeklyEmission).toBe('123000000000000000000');

    const poolA = '0x0000000000000000000000000000000000000011';
    const poolB = '0x0000000000000000000000000000000000000022';
    const gaugeA = '0x00000000000000000000000000000000000000A1';

    mockClient.readContract
      .mockResolvedValueOnce(1n) // v2 allPoolsLength
      .mockResolvedValueOnce(1n) // cl allPoolsLength
      .mockResolvedValueOnce(999n); // totalWeight

    mockClient.multicall
      .mockResolvedValueOnce([poolA]) // v2 allPools
      .mockResolvedValueOnce([poolB]) // cl allPools
      .mockResolvedValueOnce([gaugeA, 700n, ZERO_ADDRESS, 0n]); // gauges + weights

    const weightsOut = await run(['voter', 'weights']);

    expect(weightsOut.ok).toBe(true);
    expect(mockClient.multicall).toHaveBeenCalledTimes(3);

    const weightsData = weightsOut.data as {
      totalWeight: string;
      count: number;
      pools: Array<Record<string, unknown>>;
    };
    expect(weightsData.totalWeight).toBe('999');
    expect(weightsData.count).toBe(1);
    expect(weightsData.pools[0]).toMatchObject({
      pool: poolA,
      gauge: gaugeA,
      weight: '700',
    });

    vi.useRealTimers();
  });

  it('pools list returns paginated V2 pools with batched multicalls', async () => {
    mockClient.readContract.mockResolvedValueOnce(4n); // allPoolsLength

    mockClient.multicall
      .mockResolvedValueOnce([poolB, poolC]) // allPools for offset window
      .mockResolvedValueOnce([
        tokenA,
        tokenB,
        true,
        [1000n, 2000n, 1700000000n],
        5000n,
        tokenB,
        tokenC,
        false,
        [3000n, 4000n, 1700000100n],
        7000n,
      ]) // pool state
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 18 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 6 },
        { status: 'success', result: 'CCC' },
        { status: 'success', result: 18 },
      ]) // token metadata
      .mockResolvedValueOnce([
        { status: 'success', result: 4n },
        { status: 'failure', error: new Error('fee unavailable') },
      ]); // fees

    const out = await run(['pools', 'list', '--offset', '1', '--limit', '2']);

    expect(out.ok).toBe(true);
    expect(mockClient.multicall).toHaveBeenCalledTimes(4);
    expect(mockClient.multicall.mock.calls[0]?.[0]?.allowFailure).toBe(false);
    expect(mockClient.multicall.mock.calls[1]?.[0]?.allowFailure).toBe(false);
    expect(mockClient.multicall.mock.calls[2]?.[0]?.allowFailure).toBe(true);
    expect(mockClient.multicall.mock.calls[3]?.[0]?.allowFailure).toBe(true);

    const data = out.data as {
      total: number;
      offset: number;
      limit: number;
      count: number;
      pools: Array<{ pair: string; stable: boolean; fee: { feeBps: number } | null }>;
    };

    expect(data.total).toBe(4);
    expect(data.offset).toBe(1);
    expect(data.limit).toBe(2);
    expect(data.count).toBe(2);
    expect(data.pools[0]).toMatchObject({
      pair: 'AAA/BBB',
      stable: true,
      fee: { feeBps: 4 },
    });
    expect(data.pools[1]?.pair).toBe('BBB/CCC');
    expect(data.pools[1]?.stable).toBe(false);
    expect(data.pools[1]?.fee).toBeNull();
  });

  it('pools pool returns detailed state for one V2 pool', async () => {
    mockClient.multicall
      .mockResolvedValueOnce([
        tokenA,
        tokenB,
        true,
        [12345n, 67890n, 1700000200n],
        444n,
        '0x3000000000000000000000000000000000000001',
        '0x3000000000000000000000000000000000000002',
      ])
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 6 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 6 },
      ])
      .mockResolvedValueOnce([{ status: 'success', result: 2n }]);

    const out = await run(['pools', 'pool', poolA]);

    expect(out.ok).toBe(true);
    const data = out.data as {
      pool: {
        pool: string;
        pair: string;
        stable: boolean;
        totalSupply: string;
        fee: { feeBps: number } | null;
        poolFees: string;
        factory: string;
      };
    };

    expect(data.pool.pool).toBe(poolA);
    expect(data.pool.pair).toBe('AAA/BBB');
    expect(data.pool.stable).toBe(true);
    expect(data.pool.totalSupply).toBe('444');
    expect(data.pool.fee?.feeBps).toBe(2);
    expect(data.pool.poolFees).toBe('0x3000000000000000000000000000000000000001');
    expect(data.pool.factory).toBe('0x3000000000000000000000000000000000000002');
  });

  it('pools quote returns router quote for stable route', async () => {
    mockClient.multicall.mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 6 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 6 },
    ]);

    mockClient.readContract
      .mockResolvedValueOnce(poolA) // factory.getPool
      .mockResolvedValueOnce([1_000_000n, 2_500_000n]); // router.getAmountsOut

    const out = await run(['pools', 'quote', tokenA, tokenB, '1', '--stable']);

    expect(out.ok).toBe(true);
    expect(mockClient.readContract.mock.calls[0]?.[0]?.functionName).toBe('getPool');
    expect(mockClient.readContract.mock.calls[1]?.[0]?.functionName).toBe('getAmountsOut');

    const data = out.data as {
      pool: string;
      stable: boolean;
      amountIn: { raw: string };
      amountOut: { raw: string };
    };

    expect(data.pool).toBe(poolA);
    expect(data.stable).toBe(true);
    expect(data.amountIn.raw).toBe('1000000');
    expect(data.amountOut.raw).toBe('2500000');
  });

  it('pools fees returns active, stable, and volatile fee config', async () => {
    mockClient.multicall
      .mockResolvedValueOnce([tokenA, tokenB, false])
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 18 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 18 },
      ])
      .mockResolvedValueOnce([
        { status: 'success', result: 4n },
        { status: 'success', result: 30n },
      ]);

    const out = await run(['pools', 'fees', poolA]);

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      pair: string;
      stable: boolean;
      activeFee: { feeBps: number } | null;
      stableFee: { feeBps: number } | null;
      volatileFee: { feeBps: number } | null;
    };

    expect(data.pool).toBe(poolA);
    expect(data.pair).toBe('AAA/BBB');
    expect(data.stable).toBe(false);
    expect(data.activeFee?.feeBps).toBe(30);
    expect(data.stableFee?.feeBps).toBe(4);
    expect(data.volatileFee?.feeBps).toBe(30);
  });

  it('sanitizes RPC connection errors', async () => {
    mockClient.readContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'HTTP request failed.',
        message:
          'HTTP request failed.\n\nURL: https://api.mainnet.abs.xyz/\nRequest body: {"method":"eth_call"}\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['status']);

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('RPC_CONNECTION_FAILED');
    expect(out.error?.message).toContain('RPC connection failed');
    expect(out.error?.message).not.toContain('Version: viem@');
  });

  it('shows raw error details when --debug is passed', async () => {
    mockClient.readContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'HTTP request failed.',
        message: 'HTTP request failed.\n\nURL: https://api.mainnet.abs.xyz/\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['status', '--debug']);

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('UNKNOWN');
    expect(out.error?.message).toContain('Version: viem@2.47.0');
  });

  it('cl pools returns pooled CL state with batching', async () => {
    mockClient.readContract.mockResolvedValueOnce(2n);
    mockClient.multicall
      .mockResolvedValueOnce([poolA, poolB])
      .mockResolvedValueOnce([
        tokenA,
        tokenB,
        10,
        500,
        1000n,
        [2n ** 96n, 123, 0, 0, 0, true],
        tokenB,
        tokenC,
        60,
        3000,
        2000n,
        [2n ** 96n, -87, 0, 0, 0, true],
      ])
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 18 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 6 },
        { status: 'success', result: 'CCC' },
        { status: 'success', result: 18 },
      ]);

    const out = await run(['cl', 'pools']);

    expect(out.ok).toBe(true);
    const data = out.data as {
      count: number;
      pools: Array<{ pair: string; fee: number; currentTick: number }>;
    };
    expect(data.count).toBe(2);
    expect(data.pools[0]?.pair).toBe('AAA/BBB');
    expect(data.pools[0]?.fee).toBe(500);
    expect(data.pools[1]?.currentTick).toBe(-87);
    expect(mockClient.multicall).toHaveBeenCalledTimes(3);
    expect(mockClient.multicall.mock.calls[0]?.[0]?.allowFailure).toBe(false);
    expect(mockClient.multicall.mock.calls[1]?.[0]?.allowFailure).toBe(false);
    expect(mockClient.multicall.mock.calls[2]?.[0]?.allowFailure).toBe(true);
  });

  it('cl pool returns detailed pool state', async () => {
    mockClient.multicall
      .mockResolvedValueOnce([tokenA, tokenB, 10, 500, 900n, [2n ** 96n, 7, 0, 0, 0, true]])
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 18 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 6 },
      ]);

    const out = await run(['cl', 'pool', poolA]);

    expect(out.ok).toBe(true);
    const data = out.data as {
      pool: {
        pool: string;
        pair: string;
        currentTick: number;
        price: { token1PerToken0: number | null };
      };
    };
    expect(data.pool.pool).toBe('0x1000000000000000000000000000000000000001');
    expect(data.pool.pair).toBe('AAA/BBB');
    expect(data.pool.currentTick).toBe(7);
    expect(data.pool.price.token1PerToken0).not.toBeNull();
  });

  it('cl positions lists owner NFT positions with multicall', async () => {
    mockClient.readContract.mockResolvedValueOnce(2n);
    mockClient.multicall
      .mockResolvedValueOnce([11n, 12n])
      .mockResolvedValueOnce([
        [0n, tokenA, tokenA, tokenB, 10, -120, 120, 10000n, 0n, 0n, 250n, 500n],
        [0n, tokenA, tokenB, tokenC, 60, -600, 600, 8000n, 0n, 0n, 100n, 200n],
      ])
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 18 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 6 },
        { status: 'success', result: 'CCC' },
        { status: 'success', result: 18 },
      ]);

    const out = await run(['cl', 'positions', tokenA]);

    expect(out.ok).toBe(true);
    const data = out.data as {
      owner: string;
      count: number;
      positions: Array<{ tokenId: string; pair: string; tickLower: number; tickUpper: number }>;
    };
    expect(data.owner).toBe('0x2000000000000000000000000000000000000001');
    expect(data.count).toBe(2);
    expect(data.positions[0]?.tokenId).toBe('11');
    expect(data.positions[0]?.pair).toBe('AAA/BBB');
    expect(data.positions[1]?.tickLower).toBe(-600);
    expect(data.positions[1]?.tickUpper).toBe(600);
    expect(mockClient.multicall).toHaveBeenCalledTimes(3);
  });

  it('cl quote returns quoter result and selected pool metadata', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(2n)
      .mockResolvedValueOnce([3000000n, 2n ** 96n, 2, 123456n]);

    mockClient.multicall
      .mockResolvedValueOnce([poolA, poolB])
      .mockResolvedValueOnce([
        tokenA,
        tokenB,
        10,
        500,
        2500n,
        [2n ** 96n, 0, 0, 0, 0, true],
        tokenA,
        tokenB,
        60,
        3000,
        1200n,
        [2n ** 96n, 0, 0, 0, 0, true],
      ])
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 6 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 6 },
      ])
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 6 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 6 },
      ]);

    const out = await run(['cl', 'quote', tokenA, tokenB, '1.5', '--fee', '500']);

    expect(out.ok).toBe(true);
    const data = out.data as {
      pool: string;
      selectedFee: number;
      selectedTickSpacing: number;
      amountIn: { raw: string };
      amountOut: { raw: string };
    };
    expect(data.pool).toBe('0x1000000000000000000000000000000000000001');
    expect(data.selectedFee).toBe(500);
    expect(data.selectedTickSpacing).toBe(10);
    expect(data.amountIn.raw).toBe('1500000');
    expect(data.amountOut.raw).toBe('3000000');

    expect(mockClient.readContract.mock.calls[1]?.[0]?.functionName).toBe('quoteExactInputSingle');
    expect(mockClient.readContract.mock.calls[1]?.[0]?.args?.[0]?.tickSpacing).toBe(10);
  });
});
