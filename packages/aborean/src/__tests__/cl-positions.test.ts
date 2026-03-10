import type { Address, PublicClient, TransactionReceipt, WalletClient } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Envelope = {
  ok: boolean;
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

const MOCK_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Token addresses — token0 < token1 (sorted order)
const token0 = '0x2000000000000000000000000000000000000001';
const token1 = '0x2000000000000000000000000000000000000002';
const poolAddr = '0x3000000000000000000000000000000000000001';

const DEFAULT_RECEIPT = {
  transactionHash: MOCK_HASH,
  blockNumber: 42n,
  gasUsed: 150000n,
  status: 'success',
  from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
  to: '0xa4890B89dC628baE614780079ACc951Fb0ECdC5F' as Address,
  effectiveGasPrice: 1000000000n,
  blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  contractAddress: null,
  cumulativeGasUsed: 150000n,
  logs: [],
  logsBloom: '0x',
  transactionIndex: 0,
  type: 'eip1559',
} as unknown as TransactionReceipt;

const mockPublicClient = {
  readContract: vi.fn(),
  multicall: vi.fn(),
  estimateContractGas: vi.fn(),
  simulateContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
} as unknown as PublicClient;

const mockWalletClient = {
  writeContract: vi.fn(),
} as unknown as WalletClient;

function resetMockDefaults() {
  (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockReset();
  (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockReset();
  (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue(21000n);
  (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({
    result: [1n, 500_000_000_000_000_000n, 1_000_000_000_000_000_000n, 2_000_000_000_000_000_000n],
  });
  (mockPublicClient.waitForTransactionReceipt as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue(DEFAULT_RECEIPT);
  (mockWalletClient.writeContract as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue(MOCK_HASH);
}

vi.mock('../contracts/client.js', () => ({
  createAboreanPublicClient: () => mockPublicClient,
  createAboreanWalletClient: () => mockWalletClient,
  abstractMainnet: {
    id: 2741,
    name: 'Abstract Mainnet',
  },
}));

async function run(argv: string[], env?: Record<string, string>) {
  const { cli } = await import('../cli.js');
  const lines: string[] = [];
  const prevEnv: Record<string, string | undefined> = {};
  if (env) {
    for (const [key, value] of Object.entries(env)) {
      prevEnv[key] = process.env[key];
      process.env[key] = value;
    }
  }
  try {
    await cli.serve([...argv, '--format', 'json', '--verbose'], {
      stdout: (line: string) => lines.push(line),
      exit: () => undefined,
    });
  } finally {
    if (env) {
      for (const [key, value] of Object.entries(prevEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  }
  const json = [...lines].reverse().find((x) => x.trim().startsWith('{')) ?? '{}';
  return JSON.parse(json) as Envelope;
}

// Helper to mock CL pool discovery: allPoolsLength + allPools + pool state
function mockPoolDiscovery() {
  // allPoolsLength
  (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1n);

  // allPools multicall → 1 pool address
  (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([poolAddr]);

  // pool state multicall: token0, token1, tickSpacing, fee, liquidity, slot0
  (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
    token0, // token0
    token1, // token1
    200, // tickSpacing
    3000, // fee
    1_000_000_000_000_000_000n, // liquidity
    [79228162514264337593543950336n, 0, 0, 0, 0, false] as readonly [
      bigint,
      number,
      number,
      number,
      number,
      boolean,
    ], // slot0
  ]);
}

// -------------------------------------------------------------------------
// cl add-position
// -------------------------------------------------------------------------

describe('cl add-position', () => {
  beforeEach(() => {
    vi.resetModules();
    resetMockDefaults();
  });

  it('returns error for invalid token addresses', async () => {
    const out = await run(
      [
        'cl',
        'add-position',
        '--token-a',
        'not-an-address',
        '--token-b',
        token1,
        '--tick-spacing',
        '200',
        '--tick-lower',
        '-1000',
        '--tick-upper',
        '1000',
        '--amount-0',
        '1000000',
        '--amount-1',
        '1000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_ADDRESS');
  });

  it('returns error when no matching pool found', async () => {
    // allPoolsLength returns 0
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(0n);
    // allPools multicall → empty
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    // pool state multicall → empty (readPoolStates with 0 pools)
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    const out = await run(
      [
        'cl',
        'add-position',
        '--token-a',
        token0,
        '--token-b',
        token1,
        '--tick-spacing',
        '200',
        '--tick-lower',
        '-1000',
        '--tick-upper',
        '1000',
        '--amount-0',
        '1000000000000000000',
        '--amount-1',
        '2000000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('POOL_NOT_FOUND');
  });

  it('executes add-position with dry-run and returns simulation result', async () => {
    mockPoolDiscovery();

    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    // simulateContract for dry-run
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: [
        1n, // tokenId
        500_000_000_000_000_000n, // liquidity
        1_000_000_000_000_000_000n, // amount0
        2_000_000_000_000_000_000n, // amount1
      ],
    });
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      300000n,
    );

    const out = await run(
      [
        'cl',
        'add-position',
        '--token-a',
        token0,
        '--token-b',
        token1,
        '--tick-spacing',
        '200',
        '--tick-lower',
        '-1000',
        '--tick-upper',
        '1000',
        '--amount-0',
        '1000000000000000000',
        '--amount-1',
        '2000000000000000000',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      token0: { symbol: string };
      token1: { symbol: string };
      tickSpacing: number;
      tickLower: number;
      tickUpper: number;
      amount0Desired: { raw: string };
      amount1Desired: { raw: string };
      amount0Min: { raw: string };
      amount1Min: { raw: string };
      slippagePercent: number;
      tx: { dryRun: true; estimatedGas: string };
    };

    expect(data.pool).toBe(poolAddr);
    expect(data.token0.symbol).toBe('AAA');
    expect(data.token1.symbol).toBe('BBB');
    expect(data.tickSpacing).toBe(200);
    expect(data.tickLower).toBe(-1000);
    expect(data.tickUpper).toBe(1000);
    expect(data.amount0Desired.raw).toBe('1000000000000000000');
    expect(data.amount1Desired.raw).toBe('2000000000000000000');
    expect(data.slippagePercent).toBe(0.5);
    expect(data.tx.dryRun).toBe(true);
  });

  it('executes live add-position with token approvals', async () => {
    mockPoolDiscovery();

    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    // allowance calls return 0 for both tokens
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(0n) // allowance for token0
      .mockResolvedValueOnce(0n); // allowance for token1

    const out = await run(
      [
        'cl',
        'add-position',
        '--token-a',
        token0,
        '--token-b',
        token1,
        '--tick-spacing',
        '200',
        '--tick-lower',
        '-1000',
        '--tick-upper',
        '1000',
        '--amount-0',
        '1000000000000000000',
        '--amount-1',
        '2000000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      tx: { txHash: string; blockNumber: number };
    };

    expect(data.pool).toBe(poolAddr);
    expect(data.tx.txHash).toBe(MOCK_HASH);

    // Verify: 2 approvals + 1 mint = 3 writeContract calls
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(3);
    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe('approve');
    expect((writeContractCalls[1]?.[0] as Record<string, unknown>).functionName).toBe('approve');
    expect((writeContractCalls[2]?.[0] as Record<string, unknown>).functionName).toBe('mint');
  });

  it('applies custom slippage to min amounts', async () => {
    mockPoolDiscovery();

    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: [1n, 500n, 10_000n, 20_000n],
    });
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      200000n,
    );

    const out = await run(
      [
        'cl',
        'add-position',
        '--token-a',
        token0,
        '--token-b',
        token1,
        '--tick-spacing',
        '200',
        '--tick-lower',
        '-1000',
        '--tick-upper',
        '1000',
        '--amount-0',
        '10000',
        '--amount-1',
        '20000',
        '--slippage',
        '2',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      amount0Min: { raw: string };
      amount1Min: { raw: string };
      slippagePercent: number;
    };

    expect(data.slippagePercent).toBe(2);
    // 2% slippage: 10000 - (10000 * 200) / 10000 = 9800
    expect(data.amount0Min.raw).toBe('9800');
    // 2% slippage: 20000 - (20000 * 200) / 10000 = 19600
    expect(data.amount1Min.raw).toBe('19600');
  });
});

// -------------------------------------------------------------------------
// cl remove-position
// -------------------------------------------------------------------------

describe('cl remove-position', () => {
  beforeEach(() => {
    vi.resetModules();
    resetMockDefaults();
  });

  it('returns error for invalid token-id', async () => {
    const out = await run(['cl', 'remove-position', '--token-id', 'abc'], {
      PRIVATE_KEY: TEST_PRIVATE_KEY,
    });

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_TOKEN_ID');
  });

  it('returns error for position with zero liquidity', async () => {
    // positions call returns position with zero liquidity
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      0n, // nonce
      '0x0000000000000000000000000000000000000000' as Address, // operator
      token0 as Address, // token0
      token1 as Address, // token1
      200, // tickSpacing
      -1000, // tickLower
      1000, // tickUpper
      0n, // liquidity = 0
      0n, // feeGrowthInside0LastX128
      0n, // feeGrowthInside1LastX128
      0n, // tokensOwed0
      0n, // tokensOwed1
    ]);

    const out = await run(['cl', 'remove-position', '--token-id', '42'], {
      PRIVATE_KEY: TEST_PRIVATE_KEY,
    });

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('ZERO_LIQUIDITY');
  });

  it('executes remove-position with dry-run', async () => {
    // positions call
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      0n,
      '0x0000000000000000000000000000000000000000' as Address,
      token0 as Address,
      token1 as Address,
      200,
      -1000,
      1000,
      500_000_000_000_000_000n, // liquidity
      0n,
      0n,
      0n,
      0n,
    ]);

    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    // simulateContract for dry-run (decreaseLiquidity)
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: [250_000_000_000_000_000n, 500_000_000_000_000_000n],
    });
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      200000n,
    );

    const out = await run(['cl', 'remove-position', '--token-id', '42', '--dry-run'], {
      PRIVATE_KEY: TEST_PRIVATE_KEY,
    });

    expect(out.ok).toBe(true);

    const data = out.data as {
      tokenId: string;
      pair: string;
      token0: { symbol: string };
      token1: { symbol: string };
      tickLower: number;
      tickUpper: number;
      liquidity: string;
      tx: { dryRun: true; estimatedGas: string };
    };

    expect(data.tokenId).toBe('42');
    expect(data.pair).toBe('AAA/BBB');
    expect(data.tickLower).toBe(-1000);
    expect(data.tickUpper).toBe(1000);
    expect(data.liquidity).toBe('500000000000000000');
    expect(data.tx.dryRun).toBe(true);
  });

  it('executes live remove-position with decreaseLiquidity + collect + burn', async () => {
    // positions call
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      0n,
      '0x0000000000000000000000000000000000000000' as Address,
      token0 as Address,
      token1 as Address,
      200,
      -1000,
      1000,
      500_000_000_000_000_000n,
      0n,
      0n,
      0n,
      0n,
    ]);

    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    const out = await run(['cl', 'remove-position', '--token-id', '42'], {
      PRIVATE_KEY: TEST_PRIVATE_KEY,
    });

    expect(out.ok).toBe(true);

    const data = out.data as {
      tokenId: string;
      tx: { txHash: string; blockNumber: number };
    };

    expect(data.tokenId).toBe('42');
    expect(data.tx.txHash).toBe(MOCK_HASH);

    // Verify: decreaseLiquidity + collect + burn = 3 calls
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(3);
    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe(
      'decreaseLiquidity',
    );
    expect((writeContractCalls[1]?.[0] as Record<string, unknown>).functionName).toBe('collect');
    expect((writeContractCalls[2]?.[0] as Record<string, unknown>).functionName).toBe('burn');
  });
});
