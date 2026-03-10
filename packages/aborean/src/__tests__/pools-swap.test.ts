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

const mockPublicClient = {
  readContract: vi.fn(),
  multicall: vi.fn(),
  estimateContractGas: vi.fn().mockResolvedValue(21000n),
  simulateContract: vi.fn().mockResolvedValue({ result: [1_000_000n, 990_000n] }),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({
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
  } as unknown as TransactionReceipt),
} as unknown as PublicClient;

const mockWalletClient = {
  writeContract: vi.fn().mockResolvedValue(MOCK_HASH),
} as unknown as WalletClient;

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

describe('pools swap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns error for invalid token-in address', async () => {
    const out = await run(
      [
        'pools',
        'swap',
        '--token-in',
        'not-an-address',
        '--token-out',
        tokenB,
        '--amount-in',
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
        'swap',
        '--token-in',
        tokenA,
        '--token-out',
        tokenB,
        '--amount-in',
        '1000000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('POOL_NOT_FOUND');
  });

  it('returns error when router returns zero output', async () => {
    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(poolA) // getPool
      .mockResolvedValueOnce([1_000_000_000_000_000_000n, 0n]); // getAmountsOut returns 0

    const out = await run(
      [
        'pools',
        'swap',
        '--token-in',
        tokenA,
        '--token-out',
        tokenB,
        '--amount-in',
        '1000000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('ZERO_QUOTE');
  });

  it('executes swap with dry-run and returns simulation result', async () => {
    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(poolA) // getPool
      .mockResolvedValueOnce([1_000_000_000_000_000_000n, 2_500_000_000_000_000_000n]); // getAmountsOut

    // simulateContract for dry-run
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: [1_000_000_000_000_000_000n, 2_500_000_000_000_000_000n],
    });

    // estimateContractGas for dry-run
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      200000n,
    );

    const out = await run(
      [
        'pools',
        'swap',
        '--token-in',
        tokenA,
        '--token-out',
        tokenB,
        '--amount-in',
        '1000000000000000000',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      stable: boolean;
      tokenIn: { symbol: string };
      tokenOut: { symbol: string };
      amountIn: { raw: string; decimal: string };
      expectedAmountOut: { raw: string; decimal: string };
      minAmountOut: { raw: string };
      slippagePercent: number;
      effectivePrice: number | null;
      tx: { dryRun: true; estimatedGas: string };
    };

    expect(data.pool).toBe(poolA);
    expect(data.stable).toBe(false);
    expect(data.tokenIn.symbol).toBe('AAA');
    expect(data.tokenOut.symbol).toBe('BBB');
    expect(data.amountIn.raw).toBe('1000000000000000000');
    expect(data.expectedAmountOut.raw).toBe('2500000000000000000');
    expect(data.slippagePercent).toBe(0.5);
    expect(data.tx.dryRun).toBe(true);
    expect(data.effectivePrice).toBeCloseTo(2.5, 5);

    // Verify no approval call was made (dry-run skips approval)
    const readContractCalls = (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mock
      .calls;
    const allowanceCalls = readContractCalls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).functionName === 'allowance',
    );
    expect(allowanceCalls).toHaveLength(0);
  });

  it('executes live swap with approval when allowance is insufficient', async () => {
    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(poolA) // getPool
      .mockResolvedValueOnce([1_000_000_000_000_000_000n, 2_500_000_000_000_000_000n]) // getAmountsOut
      .mockResolvedValueOnce(0n); // allowance returns 0 → needs approval

    const out = await run(
      [
        'pools',
        'swap',
        '--token-in',
        tokenA,
        '--token-out',
        tokenB,
        '--amount-in',
        '1000000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      amountIn: { raw: string };
      expectedAmountOut: { raw: string };
      minAmountOut: { raw: string };
      tx: { txHash: string; blockNumber: number; gasUsed: string };
    };

    expect(data.pool).toBe(poolA);
    expect(data.tx.txHash).toBe(MOCK_HASH);
    expect(data.tx.blockNumber).toBe(42);

    // Verify writeContract was called for both approve and swap
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(2);

    // First call should be approve
    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe('approve');
    // Second call should be swapExactTokensForTokens
    expect((writeContractCalls[1]?.[0] as Record<string, unknown>).functionName).toBe(
      'swapExactTokensForTokens',
    );
  });

  it('skips approval when allowance is sufficient', async () => {
    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(poolA) // getPool
      .mockResolvedValueOnce([1_000_000_000_000_000_000n, 2_500_000_000_000_000_000n]) // getAmountsOut
      .mockResolvedValueOnce(1_000_000_000_000_000_000n); // allowance >= amountIn → skip approval

    const out = await run(
      [
        'pools',
        'swap',
        '--token-in',
        tokenA,
        '--token-out',
        tokenB,
        '--amount-in',
        '1000000000000000000',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    // Verify writeContract was called only once (swap, no approve)
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(1);
    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe(
      'swapExactTokensForTokens',
    );
  });

  it('applies custom slippage and calculates correct minAmountOut', async () => {
    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'AAA' },
      { status: 'success', result: 18 },
      { status: 'success', result: 'BBB' },
      { status: 'success', result: 18 },
    ]);

    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(poolA) // getPool
      .mockResolvedValueOnce([1_000_000_000_000_000_000n, 10_000n]); // getAmountsOut

    // dry-run
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: [1_000_000_000_000_000_000n, 10_000n],
    });
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      180000n,
    );

    const out = await run(
      [
        'pools',
        'swap',
        '--token-in',
        tokenA,
        '--token-out',
        tokenB,
        '--amount-in',
        '1000000000000000000',
        '--slippage',
        '1',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      expectedAmountOut: { raw: string };
      minAmountOut: { raw: string };
      slippagePercent: number;
    };

    expect(data.slippagePercent).toBe(1);
    expect(data.expectedAmountOut.raw).toBe('10000');
    // 1% slippage: 10000 * (10000 - 100) / 10000 = 9900
    expect(data.minAmountOut.raw).toBe('9900');
  });

  it('uses stable pool route when --stable flag is set', async () => {
    // Token metadata
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { status: 'success', result: 'USDC' },
      { status: 'success', result: 6 },
      { status: 'success', result: 'USDT' },
      { status: 'success', result: 6 },
    ]);

    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(poolA) // getPool
      .mockResolvedValueOnce([1_000_000n, 999_000n]); // getAmountsOut

    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: [1_000_000n, 999_000n],
    });
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      150000n,
    );

    const out = await run(
      [
        'pools',
        'swap',
        '--token-in',
        tokenA,
        '--token-out',
        tokenB,
        '--amount-in',
        '1000000',
        '--stable',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      stable: boolean;
      tokenIn: { symbol: string; decimals: number };
      tokenOut: { symbol: string; decimals: number };
    };

    expect(data.stable).toBe(true);
    expect(data.tokenIn.symbol).toBe('USDC');
    expect(data.tokenIn.decimals).toBe(6);

    // Verify getPool was called with stable=true
    const readContractCalls = (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mock
      .calls;
    const getPoolCall = readContractCalls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>).functionName === 'getPool',
    );
    expect((getPoolCall?.[0] as Record<string, unknown>).args).toEqual([
      expect.any(String),
      expect.any(String),
      true,
    ]);
  });
});
