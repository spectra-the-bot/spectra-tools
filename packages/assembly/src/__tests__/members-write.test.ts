import type { Address, TransactionReceipt } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Envelope = {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
  };
};

const MOCK_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as Address;
const MOCK_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;

// Valid 32-byte hex private key (deterministic test key — never use on mainnet)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const mockPublicClient = {
  readContract: vi.fn(),
  multicall: vi.fn(),
  getBalance: vi.fn(),
  getBlock: vi.fn(),
  getBlockNumber: vi.fn(),
  getContractEvents: vi.fn(),
  estimateContractGas: vi.fn().mockResolvedValue(21000n),
  simulateContract: vi.fn().mockResolvedValue({ result: undefined }),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({
    transactionHash: MOCK_HASH,
    blockNumber: 42n,
    gasUsed: 21000n,
    status: 'success',
    from: MOCK_ADDRESS,
    to: MOCK_ADDRESS,
    effectiveGasPrice: 1000000000n,
    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    contractAddress: null,
    cumulativeGasUsed: 21000n,
    logs: [],
    logsBloom: '0x',
    transactionIndex: 0,
    type: 'eip1559',
  } as unknown as TransactionReceipt),
};

const mockWalletClient = {
  writeContract: vi.fn().mockResolvedValue(MOCK_HASH),
};

vi.mock('../contracts/client.js', () => ({
  createAssemblyPublicClient: () => mockPublicClient,
  createAssemblyWalletClient: () => mockWalletClient,
  abstractMainnet: {
    id: 2741,
    name: 'Abstract Mainnet',
  },
}));

async function run(argv: string[], envOverrides?: Record<string, string>) {
  const { cli } = await import('../cli.js');
  const lines: string[] = [];
  await cli.serve([...argv, '--format', 'json', '--verbose'], {
    env: envOverrides,
    stdout: (line) => lines.push(line),
    exit: () => undefined,
  });
  const json = [...lines].reverse().find((x) => x.trim().startsWith('{')) ?? '{}';
  return JSON.parse(json) as Envelope;
}

describe('members write commands', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Reset default mocks
    mockPublicClient.estimateContractGas.mockResolvedValue(21000n);
    mockPublicClient.simulateContract.mockResolvedValue({ result: undefined });
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: MOCK_HASH,
      blockNumber: 42n,
      gasUsed: 21000n,
      status: 'success',
      from: MOCK_ADDRESS,
      to: MOCK_ADDRESS,
      effectiveGasPrice: 1000000000n,
      blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      contractAddress: null,
      cumulativeGasUsed: 21000n,
      logs: [],
      logsBloom: '0x',
      transactionIndex: 0,
      type: 'eip1559',
    } as unknown as TransactionReceipt);
    mockWalletClient.writeContract.mockResolvedValue(MOCK_HASH);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ---- register -----------------------------------------------------------
  describe('members register', () => {
    it('sends registration tx with correct fee value', async () => {
      const registrationFee = 1000000000000000n; // 0.001 ETH
      mockPublicClient.readContract.mockResolvedValueOnce(registrationFee);

      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

      const out = await run(['members', 'register'], { PRIVATE_KEY: TEST_PRIVATE_KEY });

      expect(out.ok).toBe(true);
      expect(out.data?.status).toBe('success');
      expect(out.data?.hash).toBe(MOCK_HASH);
      expect(out.data?.blockNumber).toBe(42);
      expect(out.data?.gasUsed).toBe('21000');
      expect(out.data?.fee).toBe(registrationFee.toString());
      expect(out.data?.feeEth).toContain('ETH');

      // Verify fee was logged to stderr
      expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('Registration fee'));

      // Verify writeContract was called with the fee as value
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'register',
          value: registrationFee,
        }),
      );
    });

    it('supports --dry-run (simulates without broadcasting)', async () => {
      const registrationFee = 1000000000000000n;
      mockPublicClient.readContract.mockResolvedValueOnce(registrationFee);

      const out = await run(['members', 'register', '--dry-run'], {
        PRIVATE_KEY: TEST_PRIVATE_KEY,
      });

      expect(out.ok).toBe(true);
      expect(out.data?.status).toBe('dry-run');
      expect(out.data?.estimatedGas).toBe('21000');
      expect(out.data?.fee).toBe(registrationFee.toString());
      expect(out.data?.feeEth).toContain('ETH');

      // writeContract should NOT have been called
      expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
    });

    it('produces actionable error on INSUFFICIENT_FUNDS', async () => {
      const registrationFee = 1000000000000000n;
      mockPublicClient.readContract.mockResolvedValueOnce(registrationFee);
      mockPublicClient.estimateContractGas.mockRejectedValueOnce(
        new Error('insufficient funds for gas * price + value'),
      );

      const out = await run(['members', 'register'], { PRIVATE_KEY: TEST_PRIVATE_KEY });

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('INSUFFICIENT_FUNDS');
      expect(out.error?.message).toContain('Required fee');
      // Should not have called writeContract
      expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
    });
  });

  // ---- heartbeat ----------------------------------------------------------
  describe('members heartbeat', () => {
    it('sends heartbeat tx with correct fee value', async () => {
      const heartbeatFee = 500000000000000n; // 0.0005 ETH
      mockPublicClient.readContract.mockResolvedValueOnce(heartbeatFee);

      const out = await run(['members', 'heartbeat'], { PRIVATE_KEY: TEST_PRIVATE_KEY });

      expect(out.ok).toBe(true);
      expect(out.data?.status).toBe('success');
      expect(out.data?.hash).toBe(MOCK_HASH);
      expect(out.data?.fee).toBe(heartbeatFee.toString());

      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'heartbeat',
          value: heartbeatFee,
        }),
      );
    });

    it('supports --dry-run', async () => {
      const heartbeatFee = 500000000000000n;
      mockPublicClient.readContract.mockResolvedValueOnce(heartbeatFee);

      const out = await run(['members', 'heartbeat', '--dry-run'], {
        PRIVATE_KEY: TEST_PRIVATE_KEY,
      });

      expect(out.ok).toBe(true);
      expect(out.data?.status).toBe('dry-run');
      expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
    });

    it('produces actionable error on INSUFFICIENT_FUNDS', async () => {
      const heartbeatFee = 500000000000000n;
      mockPublicClient.readContract.mockResolvedValueOnce(heartbeatFee);
      mockPublicClient.estimateContractGas.mockRejectedValueOnce(
        new Error('insufficient funds for gas * price + value'),
      );

      const out = await run(['members', 'heartbeat'], { PRIVATE_KEY: TEST_PRIVATE_KEY });

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('INSUFFICIENT_FUNDS');
      expect(out.error?.message).toContain('heartbeat');
      expect(out.error?.message).toContain(heartbeatFee.toString());
    });
  });

  // ---- renew --------------------------------------------------------------
  describe('members renew', () => {
    it('sends renewal tx calling register() with registration fee', async () => {
      const registrationFee = 1000000000000000n;
      mockPublicClient.readContract.mockResolvedValueOnce(registrationFee);

      const out = await run(['members', 'renew'], { PRIVATE_KEY: TEST_PRIVATE_KEY });

      expect(out.ok).toBe(true);
      expect(out.data?.status).toBe('success');
      expect(out.data?.hash).toBe(MOCK_HASH);
      expect(out.data?.fee).toBe(registrationFee.toString());

      // renew calls register() under the hood
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: 'register',
          value: registrationFee,
        }),
      );
    });

    it('supports --dry-run', async () => {
      const registrationFee = 1000000000000000n;
      mockPublicClient.readContract.mockResolvedValueOnce(registrationFee);

      const out = await run(['members', 'renew', '--dry-run'], {
        PRIVATE_KEY: TEST_PRIVATE_KEY,
      });

      expect(out.ok).toBe(true);
      expect(out.data?.status).toBe('dry-run');
      expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
    });

    it('produces actionable error on INSUFFICIENT_FUNDS', async () => {
      const registrationFee = 1000000000000000n;
      mockPublicClient.readContract.mockResolvedValueOnce(registrationFee);
      mockPublicClient.estimateContractGas.mockRejectedValueOnce(
        new Error("sender doesn't have enough funds to send tx"),
      );

      const out = await run(['members', 'renew'], { PRIVATE_KEY: TEST_PRIVATE_KEY });

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('INSUFFICIENT_FUNDS');
      expect(out.error?.message).toContain('renew');
      expect(out.error?.message).toContain(registrationFee.toString());
    });
  });

  // ---- existing read commands unaffected ----------------------------------
  describe('existing read commands still work', () => {
    it('members count still works', async () => {
      mockPublicClient.readContract.mockResolvedValueOnce(10n).mockResolvedValueOnce(20n);
      const out = await run(['members', 'count']);
      expect(out.ok).toBe(true);
    });

    it('members fees still works', async () => {
      mockPublicClient.readContract
        .mockResolvedValueOnce(1000000000000000n)
        .mockResolvedValueOnce(500000000000000n)
        .mockResolvedValueOnce(604800n);
      const out = await run(['members', 'fees']);
      expect(out.ok).toBe(true);
    });
  });
});
