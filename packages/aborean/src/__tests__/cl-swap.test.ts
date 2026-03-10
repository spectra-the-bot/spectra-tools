import type { Address, PublicClient, TransactionReceipt, WalletClient } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
const tokenA = '0x2000000000000000000000000000000000000001';
const tokenB = '0x2000000000000000000000000000000000000002';
const poolA = '0x1000000000000000000000000000000000000001';
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const mockPublicClient = {
  readContract: vi.fn(),
  multicall: vi.fn(),
  estimateContractGas: vi.fn().mockResolvedValue(150000n),
  simulateContract: vi.fn().mockResolvedValue({ result: 2900000n }),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({
    transactionHash: MOCK_HASH,
    blockNumber: 100n,
    gasUsed: 145000n,
    status: 'success',
    from: '0x0000000000000000000000000000000000000000' as Address,
    to: '0x0000000000000000000000000000000000000000' as Address,
    effectiveGasPrice: 1000000000n,
    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    contractAddress: null,
    cumulativeGasUsed: 145000n,
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
      stdout: (line) => lines.push(line),
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

function setupPoolDiscoveryMocks() {
  // allPoolsLength
  (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1n);

  // multicall for allPools
  (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([poolA]);

  // multicall for readPoolStates (token0, token1, tickSpacing, fee, liquidity, slot0)
  (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
    tokenA,
    tokenB,
    10,
    500,
    5000n,
    [2n ** 96n, 0, 0, 0, 0, true],
  ]);

  // multicall for readTokenMetadata
  (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
    { status: 'success', result: 'AAA' },
    { status: 'success', result: 6 },
    { status: 'success', result: 'BBB' },
    { status: 'success', result: 6 },
  ]);
}

describe('cl swap', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();

    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValue(150000n);
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: 2900000n,
    });
    (mockPublicClient.waitForTransactionReceipt as ReturnType<typeof vi.fn>).mockResolvedValue({
      transactionHash: MOCK_HASH,
      blockNumber: 100n,
      gasUsed: 145000n,
      status: 'success',
      from: '0x0000000000000000000000000000000000000000' as Address,
      to: '0x0000000000000000000000000000000000000000' as Address,
      effectiveGasPrice: 1000000000n,
      blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      contractAddress: null,
      cumulativeGasUsed: 145000n,
      logs: [],
      logsBloom: '0x',
      transactionIndex: 0,
      type: 'eip1559',
    } as unknown as TransactionReceipt);
    (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_HASH);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes a live swap and returns tx result', async () => {
    setupPoolDiscoveryMocks();

    // quoteExactInputSingle
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      3000000n,
      2n ** 96n,
      2,
      150000n,
    ]);

    const out = await run(
      ['cl', 'swap', '--token-in', tokenA, '--token-out', tokenB, '--amount-in', '1000000'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      pool: string;
      tokenIn: { symbol: string };
      tokenOut: { symbol: string };
      amountIn: { raw: string; decimal: string };
      quotedAmountOut: { raw: string; decimal: string };
      amountOutMinimum: { raw: string; decimal: string };
      slippagePercent: number;
      deadlineSeconds: number;
      tx: { txHash: string; blockNumber: number; gasUsed: string };
    };

    expect(data.pool).toBe(poolA);
    expect(data.tokenIn.symbol).toBe('AAA');
    expect(data.tokenOut.symbol).toBe('BBB');
    expect(data.amountIn.raw).toBe('1000000');
    expect(data.quotedAmountOut.raw).toBe('3000000');
    // default slippage 0.5% = 50 bps: 3000000 - (3000000 * 50 / 10000) = 2985000
    expect(data.amountOutMinimum.raw).toBe('2985000');
    expect(data.slippagePercent).toBe(0.5);
    expect(data.deadlineSeconds).toBe(300);
    expect(data.tx.txHash).toBe(MOCK_HASH);
    expect(data.tx.blockNumber).toBe(100);
  });

  it('supports --dry-run mode and skips broadcast', async () => {
    setupPoolDiscoveryMocks();

    // quoteExactInputSingle
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      3000000n,
      2n ** 96n,
      2,
      150000n,
    ]);

    const out = await run(
      [
        'cl',
        'swap',
        '--token-in',
        tokenA,
        '--token-out',
        tokenB,
        '--amount-in',
        '1000000',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      tx: { dryRun: true; estimatedGas: string };
    };

    expect(data.tx.dryRun).toBe(true);
    expect(data.tx.estimatedGas).toBe('150000');
    expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
  });

  it('applies custom slippage tolerance', async () => {
    setupPoolDiscoveryMocks();

    // quoteExactInputSingle
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      10000n,
      2n ** 96n,
      1,
      100000n,
    ]);

    const out = await run(
      [
        'cl',
        'swap',
        '--token-in',
        tokenA,
        '--token-out',
        tokenB,
        '--amount-in',
        '5000',
        '--slippage',
        '1',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      slippagePercent: number;
      quotedAmountOut: { raw: string };
      amountOutMinimum: { raw: string };
    };

    expect(data.slippagePercent).toBe(1);
    // 1% slippage = 100 bps: 10000 - (10000 * 100 / 10000) = 9900
    expect(data.amountOutMinimum.raw).toBe('9900');
  });

  it('rejects invalid token-in address', async () => {
    const out = await run(
      ['cl', 'swap', '--token-in', 'not-an-address', '--token-out', tokenB, '--amount-in', '1000'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_ADDRESS');
  });

  it('rejects invalid amount-in', async () => {
    const out = await run(
      ['cl', 'swap', '--token-in', tokenA, '--token-out', tokenB, '--amount-in', 'not-a-number'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_AMOUNT');
  });

  it('rejects zero amount-in', async () => {
    const out = await run(
      ['cl', 'swap', '--token-in', tokenA, '--token-out', tokenB, '--amount-in', '0'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_AMOUNT');
  });

  it('errors when no pool is found for the pair', async () => {
    // allPoolsLength
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(1n);

    // multicall for allPools
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([poolA]);

    // pool states with different tokens (not matching our pair)
    const otherToken = '0x3000000000000000000000000000000000000001';
    const otherToken2 = '0x3000000000000000000000000000000000000002';
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      otherToken,
      otherToken2,
      10,
      500,
      5000n,
      [2n ** 96n, 0, 0, 0, 0, true],
    ]);

    const out = await run(
      ['cl', 'swap', '--token-in', tokenA, '--token-out', tokenB, '--amount-in', '1000'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('POOL_NOT_FOUND');
  });
});
