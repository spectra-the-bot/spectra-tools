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

const gaugeA = '0x3000000000000000000000000000000000000001';
const stakingTokenA = '0x4000000000000000000000000000000000000001';

const mockPublicClient = {
  readContract: vi.fn(),
  multicall: vi.fn(),
  estimateContractGas: vi.fn().mockResolvedValue(150000n),
  simulateContract: vi.fn().mockResolvedValue({ result: undefined }),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({
    transactionHash: MOCK_HASH,
    blockNumber: 50n,
    gasUsed: 120000n,
    status: 'success',
    from: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as Address,
    to: gaugeA as Address,
    effectiveGasPrice: 1000000000n,
    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    contractAddress: null,
    cumulativeGasUsed: 120000n,
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

describe('gauges deposit', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns error for invalid gauge address', async () => {
    const out = await run(
      ['gauges', 'deposit', '--gauge', 'not-an-address', '--amount', '1000000000000000000'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_ADDRESS');
  });

  it('returns error for zero amount', async () => {
    const out = await run(['gauges', 'deposit', '--gauge', gaugeA, '--amount', '0'], {
      PRIVATE_KEY: TEST_PRIVATE_KEY,
    });

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_AMOUNT');
  });

  it('returns error when gauge is not alive', async () => {
    // isAlive returns false
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const out = await run(
      ['gauges', 'deposit', '--gauge', gaugeA, '--amount', '1000000000000000000'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('GAUGE_NOT_ALIVE');
  });

  it('executes dry-run deposit successfully', async () => {
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true) // isAlive
      .mockResolvedValueOnce(stakingTokenA); // stakingToken

    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      150000n,
    );
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: undefined,
    });

    const out = await run(
      ['gauges', 'deposit', '--gauge', gaugeA, '--amount', '1000000000000000000', '--dry-run'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      gauge: string;
      stakingToken: string;
      amount: string;
      tokenId: number | null;
      tx: { dryRun: true; estimatedGas: string };
    };

    expect(data.amount).toBe('1000000000000000000');
    expect(data.tokenId).toBeNull();
    expect(data.tx.dryRun).toBe(true);

    // Verify no approval was made (dry-run skips approval)
    const readContractCalls = (mockPublicClient.readContract as ReturnType<typeof vi.fn>).mock
      .calls;
    const allowanceCalls = readContractCalls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>).functionName === 'allowance',
    );
    expect(allowanceCalls).toHaveLength(0);
  });

  it('executes live deposit with approval when allowance is insufficient', async () => {
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true) // isAlive
      .mockResolvedValueOnce(stakingTokenA) // stakingToken
      .mockResolvedValueOnce(0n); // allowance returns 0 → needs approval

    const out = await run(
      ['gauges', 'deposit', '--gauge', gaugeA, '--amount', '1000000000000000000'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      gauge: string;
      amount: string;
      tx: { txHash: string; blockNumber: number; gasUsed: string };
    };

    expect(data.tx.txHash).toBe(MOCK_HASH);
    expect(data.tx.blockNumber).toBe(50);

    // Verify writeContract was called for both approve and deposit
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(2);
    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe('approve');
    expect((writeContractCalls[1]?.[0] as Record<string, unknown>).functionName).toBe('deposit');
  });

  it('skips approval when allowance is sufficient', async () => {
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true) // isAlive
      .mockResolvedValueOnce(stakingTokenA) // stakingToken
      .mockResolvedValueOnce(1_000_000_000_000_000_000n); // allowance >= amount

    const out = await run(
      ['gauges', 'deposit', '--gauge', gaugeA, '--amount', '1000000000000000000'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    // Verify only deposit was called (no approve)
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(1);
    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe('deposit');
  });

  it('passes tokenId argument for boosted deposit', async () => {
    (mockPublicClient.readContract as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(true) // isAlive
      .mockResolvedValueOnce(stakingTokenA); // stakingToken

    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      160000n,
    );
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: undefined,
    });

    const out = await run(
      [
        'gauges',
        'deposit',
        '--gauge',
        gaugeA,
        '--amount',
        '1000000000000000000',
        '--token-id',
        '42',
        '--dry-run',
      ],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      tokenId: number | null;
      tx: { dryRun: true };
    };

    expect(data.tokenId).toBe(42);
  });
});

describe('gauges withdraw', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns error for invalid gauge address', async () => {
    const out = await run(
      ['gauges', 'withdraw', '--gauge', 'bad-addr', '--amount', '1000000000000000000'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_ADDRESS');
  });

  it('returns error for zero amount', async () => {
    const out = await run(['gauges', 'withdraw', '--gauge', gaugeA, '--amount', '0'], {
      PRIVATE_KEY: TEST_PRIVATE_KEY,
    });

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_AMOUNT');
  });

  it('executes dry-run withdraw successfully', async () => {
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      100000n,
    );
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: undefined,
    });

    const out = await run(
      ['gauges', 'withdraw', '--gauge', gaugeA, '--amount', '500000000000000000', '--dry-run'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      gauge: string;
      amount: string;
      tx: { dryRun: true; estimatedGas: string };
    };

    expect(data.amount).toBe('500000000000000000');
    expect(data.tx.dryRun).toBe(true);
  });

  it('executes live withdraw successfully', async () => {
    const out = await run(
      ['gauges', 'withdraw', '--gauge', gaugeA, '--amount', '500000000000000000'],
      { PRIVATE_KEY: TEST_PRIVATE_KEY },
    );

    expect(out.ok).toBe(true);

    const data = out.data as {
      gauge: string;
      amount: string;
      tx: { txHash: string; blockNumber: number; gasUsed: string };
    };

    expect(data.tx.txHash).toBe(MOCK_HASH);
    expect(data.tx.blockNumber).toBe(50);

    // Verify writeContract was called for withdraw only
    const writeContractCalls = (mockWalletClient.writeContract as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(writeContractCalls.length).toBe(1);
    expect((writeContractCalls[0]?.[0] as Record<string, unknown>).functionName).toBe('withdraw');
  });
});
