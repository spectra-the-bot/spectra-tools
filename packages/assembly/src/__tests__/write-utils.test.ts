import type { DryRunResult, TxResult } from '@spectratools/tx-shared';
import type { Account, Address, PublicClient, TransactionReceipt, WalletClient } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const MOCK_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as Address;
const MOCK_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;

// Valid 32-byte hex private key (deterministic test key — never use on mainnet)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const mockPublicClient = {
  estimateContractGas: vi.fn().mockResolvedValue(21000n),
  simulateContract: vi.fn().mockResolvedValue({ result: true }),
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
} as unknown as PublicClient;

const mockWalletClient = {
  writeContract: vi.fn().mockResolvedValue(MOCK_HASH),
} as unknown as WalletClient;

vi.mock('../contracts/client.js', () => ({
  createAssemblyPublicClient: () => mockPublicClient,
  createAssemblyWalletClient: () => mockWalletClient,
  abstractMainnet: {
    id: 2741,
    name: 'Abstract Mainnet',
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { writeEnv, writeOptions, resolveAccount, formatTxResult, assemblyWriteTx } = await import(
  '../commands/_write-utils.js'
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('writeEnv', () => {
  it('requires PRIVATE_KEY', () => {
    const result = writeEnv.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts valid PRIVATE_KEY and optional ABSTRACT_RPC_URL', () => {
    const result = writeEnv.safeParse({
      PRIVATE_KEY: TEST_PRIVATE_KEY,
      ABSTRACT_RPC_URL: 'https://custom-rpc.example.com',
    });
    expect(result.success).toBe(true);
  });

  it('accepts PRIVATE_KEY without ABSTRACT_RPC_URL', () => {
    const result = writeEnv.safeParse({ PRIVATE_KEY: TEST_PRIVATE_KEY });
    expect(result.success).toBe(true);
  });
});

describe('writeOptions', () => {
  it('has correct defaults', () => {
    const result = writeOptions.parse({});
    expect(result['dry-run']).toBe(false);
    expect(result['gas-limit']).toBeUndefined();
    expect(result['max-fee']).toBeUndefined();
    expect(result.nonce).toBeUndefined();
  });

  it('accepts all options', () => {
    const result = writeOptions.parse({
      'dry-run': true,
      'gas-limit': '100000',
      'max-fee': '2000000000',
      nonce: 5,
    });
    expect(result['dry-run']).toBe(true);
    expect(result['gas-limit']).toBe('100000');
    expect(result['max-fee']).toBe('2000000000');
    expect(result.nonce).toBe(5);
  });
});

describe('resolveAccount', () => {
  it('returns a valid Account from hex private key', () => {
    const account = resolveAccount({ PRIVATE_KEY: TEST_PRIVATE_KEY });
    expect(account).toBeDefined();
    expect(account.address).toBeDefined();
    expect(account.type).toBe('local');
  });

  it('throws on invalid private key format', () => {
    expect(() => resolveAccount({ PRIVATE_KEY: 'not-a-key' })).toThrow();
  });

  it('throws on too-short private key', () => {
    expect(() => resolveAccount({ PRIVATE_KEY: '0xdead' })).toThrow();
  });
});

describe('formatTxResult', () => {
  it('formats TxResult with all fields as JSON-safe values', () => {
    const txResult: TxResult = {
      hash: MOCK_HASH,
      blockNumber: 42n,
      gasUsed: 21000n,
      status: 'success',
      from: MOCK_ADDRESS,
      to: MOCK_ADDRESS,
      effectiveGasPrice: 1000000000n,
    };

    const formatted = formatTxResult(txResult);
    expect(formatted).toEqual({
      status: 'success',
      hash: MOCK_HASH,
      blockNumber: 42,
      gasUsed: '21000',
      from: MOCK_ADDRESS,
      to: MOCK_ADDRESS,
      effectiveGasPrice: '1000000000',
    });
  });

  it('formats TxResult without effectiveGasPrice when absent', () => {
    const txResult: TxResult = {
      hash: MOCK_HASH,
      blockNumber: 10n,
      gasUsed: 50000n,
      status: 'success',
      from: MOCK_ADDRESS,
      to: null,
    };

    const formatted = formatTxResult(txResult);
    expect(formatted).toEqual({
      status: 'success',
      hash: MOCK_HASH,
      blockNumber: 10,
      gasUsed: '50000',
      from: MOCK_ADDRESS,
      to: null,
    });
    expect(formatted).not.toHaveProperty('effectiveGasPrice');
  });

  it('formats DryRunResult correctly', () => {
    const dryRun: DryRunResult = {
      status: 'dry-run',
      estimatedGas: 21000n,
      simulationResult: true,
    };

    const formatted = formatTxResult(dryRun);
    expect(formatted).toEqual({
      status: 'dry-run',
      estimatedGas: '21000',
      simulationResult: true,
    });
  });

  it('handles bigint simulation results in DryRunResult', () => {
    const dryRun: DryRunResult = {
      status: 'dry-run',
      estimatedGas: 50000n,
      simulationResult: 123456789n,
    };

    const formatted = formatTxResult(dryRun);
    expect(formatted).toEqual({
      status: 'dry-run',
      estimatedGas: '50000',
      simulationResult: '123456789',
    });
  });
});

describe('assemblyWriteTx', () => {
  const TEST_ABI = [
    {
      type: 'function',
      name: 'transfer',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
    },
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orchestrates full lifecycle and returns formatted TxResult', async () => {
    const result = await assemblyWriteTx({
      env: { PRIVATE_KEY: TEST_PRIVATE_KEY },
      options: { 'dry-run': false },
      address: MOCK_ADDRESS,
      abi: TEST_ABI as unknown as import('viem').Abi,
      functionName: 'transfer',
      args: [MOCK_ADDRESS, 1000n],
    });

    expect(result.status).toBe('success');
    expect(result).toHaveProperty('hash');
    expect(result).toHaveProperty('blockNumber');
    expect(result).toHaveProperty('gasUsed');
  });

  it('returns formatted DryRunResult when dry-run is true', async () => {
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      30000n,
    );
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: true,
    });

    const result = await assemblyWriteTx({
      env: { PRIVATE_KEY: TEST_PRIVATE_KEY },
      options: { 'dry-run': true },
      address: MOCK_ADDRESS,
      abi: TEST_ABI as unknown as import('viem').Abi,
      functionName: 'transfer',
      args: [MOCK_ADDRESS, 1000n],
    });

    expect(result.status).toBe('dry-run');
    expect(result).toHaveProperty('estimatedGas');
    expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
  });

  it('passes gas overrides to executeTx', async () => {
    await assemblyWriteTx({
      env: { PRIVATE_KEY: TEST_PRIVATE_KEY },
      options: {
        'dry-run': false,
        'gas-limit': '100000',
        'max-fee': '2000000000',
        nonce: 7,
      },
      address: MOCK_ADDRESS,
      abi: TEST_ABI as unknown as import('viem').Abi,
      functionName: 'transfer',
      args: [MOCK_ADDRESS, 1000n],
    });

    expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        gas: 100000n,
        maxFeePerGas: 2000000000n,
        nonce: 7,
      }),
    );
  });
});
