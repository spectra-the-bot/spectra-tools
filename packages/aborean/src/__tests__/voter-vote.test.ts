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

const poolA = '0x1000000000000000000000000000000000000001';
const poolB = '0x1000000000000000000000000000000000000002';
const gaugeA = '0x3000000000000000000000000000000000000001';
const gaugeB = '0x3000000000000000000000000000000000000002';

const mockPublicClient = {
  readContract: vi.fn(),
  multicall: vi.fn(),
  estimateContractGas: vi.fn().mockResolvedValue(200000n),
  simulateContract: vi.fn().mockResolvedValue({ result: undefined }),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({
    transactionHash: MOCK_HASH,
    blockNumber: 60n,
    gasUsed: 180000n,
    status: 'success',
    from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
    to: '0xC0F53703e9f4b79fA2FB09a2aeBA487FA97729c9' as Address,
    effectiveGasPrice: 1000000000n,
    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    contractAddress: null,
    cumulativeGasUsed: 180000n,
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

describe('voter vote', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns error for invalid pool address', async () => {
    const out = await run(
      ['voter', 'vote', '--token-id', '1', '--pools', 'not-an-address', '--weights', '100'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_ADDRESS');
  });

  it('returns error when pool and weight count mismatch', async () => {
    const out = await run(
      ['voter', 'vote', '--token-id', '1', '--pools', `${poolA},${poolB}`, '--weights', '100'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_INPUT');
    expect(out.error?.message).toContain('count');
  });

  it('returns error when gauge does not exist for pool', async () => {
    // gauges multicall returns zero address for the pool
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>).mockResolvedValueOnce([ZERO_ADDRESS]);

    const out = await run(
      ['voter', 'vote', '--token-id', '1', '--pools', poolA, '--weights', '100'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('GAUGE_NOT_FOUND');
  });

  it('returns error when gauge is not alive', async () => {
    // gauges multicall returns a valid gauge
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([gaugeA]) // gauges lookup
      .mockResolvedValueOnce([false]); // isAlive returns false

    const out = await run(
      ['voter', 'vote', '--token-id', '1', '--pools', poolA, '--weights', '100'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('GAUGE_NOT_ALIVE');
  });

  it('executes dry-run vote for single pool', async () => {
    // gauges multicall returns a valid gauge
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([gaugeA]) // gauges lookup
      .mockResolvedValueOnce([true]); // isAlive

    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      200000n,
    );
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: undefined,
    });

    const out = await run(
      ['voter', 'vote', '--token-id', '1', '--pools', poolA, '--weights', '100', '--dry-run'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      tokenId: number;
      pools: string[];
      weights: string[];
      tx: { dryRun: true; estimatedGas: string };
    };

    expect(data.tokenId).toBe(1);
    expect(data.pools).toHaveLength(1);
    expect(data.weights).toEqual(['100']);
    expect(data.tx.dryRun).toBe(true);
  });

  it('executes live vote for multiple pools', async () => {
    // gauges multicall returns valid gauges
    (mockPublicClient.multicall as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce([gaugeA, gaugeB]) // gauges lookup
      .mockResolvedValueOnce([true, true]); // isAlive

    const out = await run(
      ['voter', 'vote', '--token-id', '5', '--pools', `${poolA},${poolB}`, '--weights', '60,40'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      tokenId: number;
      pools: string[];
      weights: string[];
      tx: { txHash: string; blockNumber: number; gasUsed: string };
    };

    expect(data.tokenId).toBe(5);
    expect(data.pools).toHaveLength(2);
    expect(data.weights).toEqual(['60', '40']);
    expect(data.tx.txHash).toBe(MOCK_HASH);
    expect(data.tx.blockNumber).toBe(60);

    // Verify writeContract was called once for vote
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(1);
    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe('vote');
  });

  it('returns error for zero weight', async () => {
    const out = await run(
      ['voter', 'vote', '--token-id', '1', '--pools', poolA, '--weights', '0'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_INPUT');
    expect(out.error?.message).toContain('positive');
  });
});
