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
      .mockResolvedValueOnce(42n) // v2 allPoolsLength
      .mockResolvedValueOnce(15n) // CL allPoolsLength
      .mockResolvedValueOnce(30n) // voter length
      .mockResolvedValueOnce(1000000000000000000000n) // totalWeight
      .mockResolvedValueOnce(5000000000000000000000n) // veABX totalSupply
      .mockResolvedValueOnce(4000000000000000000000n); // veABX supply (locked)

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
});
