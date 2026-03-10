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

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MOCK_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const tokenA = '0x2000000000000000000000000000000000000001';
const tokenB = '0x2000000000000000000000000000000000000002';
const poolA = '0x1000000000000000000000000000000000000001';

const DEFAULT_RECEIPT = {
  transactionHash: MOCK_HASH,
  blockNumber: 42n,
  gasUsed: 150000n,
  status: 'success',
  from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
  to: '0xE8142D2f82036B6FC1e79E4aE85cF53FBFfDC998' as Address,
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
  (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>)
    .mockReset()
    .mockResolvedValue({ result: [1_000_000n, 1_000_000n, 500_000n] });
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

// -------------------------------------------------------------------------
// pools add-liquidity
// -------------------------------------------------------------------------

describe('pools add-liquidity', () => {
  beforeEach(() => {
    vi.resetModules();
    resetMockDefaults();
  });

  it('returns error for invalid token addresses', async () => {
    const out = await run(
      [
        'pools',
        'add-liquidity',
        '--token-a',
        'not-an-address',
        '--token-b',
        tokenB,
        '--amount-a',
        '1000000',
        '--amount-b',
        '1000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_ADDRESS');
  });

  it('returns error when pool is not found', async () => {
    // Token metadata multicall
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    // getPool returns zero address
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(ZERO_ADDRESS);

    const out = await run(
      [
        'pools',
        'add-liquidity',
        '--token-a',
        tokenA,
        '--token-b',
        tokenB,
        '--amount-a',
        '1000000000000000000',
        '--amount-b',
        '2000000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('POOL_NOT_FOUND');
  });

  it('executes add-liquidity with dry-run and returns simulation result', async () => {
    // getPool returns a real pool
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(poolA);

    // Token metadata multicall
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    // simulateContract for dry-run
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: [1_000_000_000_000_000_000n, 2_000_000_000_000_000_000n, 1_500_000_000_000_000_000n],
    });

    // estimateContractGas
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      200000n,
    );

    const out = await run(
      [
        'pools',
        'add-liquidity',
        '--token-a',
        tokenA,
        '--token-b',
        tokenB,
        '--amount-a',
        '1000000000000000000',
        '--amount-b',
        '2000000000000000000',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      stable: boolean;
      tokenA: { symbol: string };
      tokenB: { symbol: string };
      amountADesired: { raw: string };
      amountBDesired: { raw: string };
      amountAMin: { raw: string };
      amountBMin: { raw: string };
      slippagePercent: number;
      tx: { dryRun: true; estimatedGas: string };
    };

    expect(data.pool).toBe(poolA);
    expect(data.stable).toBe(false);
    expect(data.tokenA.symbol).toBe('AAA');
    expect(data.tokenB.symbol).toBe('BBB');
    expect(data.amountADesired.raw).toBe('1000000000000000000');
    expect(data.amountBDesired.raw).toBe('2000000000000000000');
    expect(data.slippagePercent).toBe(0.5);
    expect(data.tx.dryRun).toBe(true);
  });

  it('executes live add-liquidity with approval when allowance is insufficient', async () => {
    // getPool returns a real pool
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(poolA) // getPool
      .mockResolvedValueOnce(0n) // allowance for tokenA
      .mockResolvedValueOnce(0n); // allowance for tokenB

    // Token metadata multicall
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    const out = await run(
      [
        'pools',
        'add-liquidity',
        '--token-a',
        tokenA,
        '--token-b',
        tokenB,
        '--amount-a',
        '1000000000000000000',
        '--amount-b',
        '2000000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      tx: { txHash: string; blockNumber: number; gasUsed: string };
    };

    expect(data.pool).toBe(poolA);
    expect(data.tx.txHash).toBe(MOCK_HASH);

    // Verify writeContract was called for 2 approvals + 1 addLiquidity = 3
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(3);

    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe('approve');
    expect((writeContractCalls[1]?.[0] as Record<string, unknown>).functionName).toBe('approve');
    expect((writeContractCalls[2]?.[0] as Record<string, unknown>).functionName).toBe(
      'addLiquidity',
    );
  });

  it('applies custom slippage and calculates correct min amounts', async () => {
    // getPool returns a real pool
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(poolA);

    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: [10_000n, 20_000n, 15_000n],
    });
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      180000n,
    );

    const out = await run(
      [
        'pools',
        'add-liquidity',
        '--token-a',
        tokenA,
        '--token-b',
        tokenB,
        '--amount-a',
        '10000',
        '--amount-b',
        '20000',
        '--slippage',
        '1',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      amountADesired: { raw: string };
      amountBDesired: { raw: string };
      amountAMin: { raw: string };
      amountBMin: { raw: string };
      slippagePercent: number;
    };

    expect(data.slippagePercent).toBe(1);
    // 1% slippage: 10000 * (10000 - 100) / 10000 = 9900
    expect(data.amountAMin.raw).toBe('9900');
    // 1% slippage: 20000 * (10000 - 100) / 10000 = 19800
    expect(data.amountBMin.raw).toBe('19800');
  });
});

// -------------------------------------------------------------------------
// pools remove-liquidity
// -------------------------------------------------------------------------

describe('pools remove-liquidity', () => {
  beforeEach(() => {
    vi.resetModules();
    resetMockDefaults();
  });

  it('returns error for invalid token addresses', async () => {
    const out = await run(
      [
        'pools',
        'remove-liquidity',
        '--token-a',
        'not-an-address',
        '--token-b',
        tokenB,
        '--liquidity',
        '1000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_ADDRESS');
  });

  it('returns error when pool is not found', async () => {
    // Token metadata multicall
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    // getPool returns zero address
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(ZERO_ADDRESS);

    const out = await run(
      [
        'pools',
        'remove-liquidity',
        '--token-a',
        tokenA,
        '--token-b',
        tokenB,
        '--liquidity',
        '500000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('POOL_NOT_FOUND');
  });

  it('executes remove-liquidity with dry-run', async () => {
    // getPool returns a real pool
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(poolA);

    // readPoolStates multicall: token0, token1, stable, getReserves, totalSupply
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        tokenA, // token0
        tokenB, // token1
        false, // stable
        [10_000_000_000_000_000_000n, 20_000_000_000_000_000_000n, 1000n], // reserves
        2_000_000_000_000_000_000n, // totalSupply
      ])
      // Token metadata multicall
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 18 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 18 },
      ]);

    // simulateContract for dry-run
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: [5_000_000_000_000_000_000n, 10_000_000_000_000_000_000n],
    });
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      200000n,
    );

    const out = await run(
      [
        'pools',
        'remove-liquidity',
        '--token-a',
        tokenA,
        '--token-b',
        tokenB,
        '--liquidity',
        '1000000000000000000',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      stable: boolean;
      tokenA: { symbol: string };
      tokenB: { symbol: string };
      liquidity: { raw: string };
      amountAMin: { raw: string };
      amountBMin: { raw: string };
      slippagePercent: number;
      tx: { dryRun: true; estimatedGas: string };
    };

    expect(data.pool).toBe(poolA);
    expect(data.stable).toBe(false);
    expect(data.liquidity.raw).toBe('1000000000000000000');
    expect(data.tx.dryRun).toBe(true);
    expect(data.slippagePercent).toBe(0.5);
  });

  it('executes live remove-liquidity with LP token approval', async () => {
    // getPool
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(poolA) // getPool
      .mockResolvedValueOnce(0n); // allowance for LP token

    // readPoolStates multicall + token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([
        tokenA, // token0
        tokenB, // token1
        false, // stable
        [10_000_000_000_000_000_000n, 20_000_000_000_000_000_000n, 1000n], // reserves
        2_000_000_000_000_000_000n, // totalSupply
      ])
      .mockResolvedValueOnce([
        { status: 'success', result: 'AAA' },
        { status: 'success', result: 18 },
        { status: 'success', result: 'BBB' },
        { status: 'success', result: 18 },
      ]);

    const out = await run(
      [
        'pools',
        'remove-liquidity',
        '--token-a',
        tokenA,
        '--token-b',
        tokenB,
        '--liquidity',
        '1000000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      tx: { txHash: string; blockNumber: number };
    };

    expect(data.pool).toBe(poolA);
    expect(data.tx.txHash).toBe(MOCK_HASH);

    // Verify writeContract: 1 approve + 1 removeLiquidity
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(2);
    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe('approve');
    expect((writeContractCalls[1]?.[0] as Record<string, unknown>).functionName).toBe(
      'removeLiquidity',
    );
  });
});
