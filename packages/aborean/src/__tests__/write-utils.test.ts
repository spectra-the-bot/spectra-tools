import type { DryRunResult, TxResult } from '@spectratools/tx-shared';
import type { Address, PublicClient, TransactionReceipt, WalletClient } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const MOCK_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as Address;
const MOCK_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;
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
  createAboreanPublicClient: () => mockPublicClient,
  createAboreanWalletClient: () => mockWalletClient,
  abstractMainnet: {
    id: 2741,
    name: 'Abstract Mainnet',
  },
}));

const { writeEnv, writeOptions, resolveAccount, formatTxResult, aboreanWriteTx } = await import(
  '../commands/_write-utils.js'
);

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

  it('rejects empty PRIVATE_KEY with a clear error', () => {
    const result = writeEnv.safeParse({ PRIVATE_KEY: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Missing PRIVATE_KEY env var');
    }
  });
});

describe('writeOptions', () => {
  it('has expected defaults', () => {
    const result = writeOptions.parse({});
    expect(result['dry-run']).toBe(false);
    expect(result['gas-limit']).toBeUndefined();
    expect(result['max-fee']).toBeUndefined();
    expect(result.nonce).toBeUndefined();
  });

  it('accepts all write option overrides', () => {
    const result = writeOptions.parse({
      'dry-run': true,
      'gas-limit': '100000',
      'max-fee': '2000000000',
      nonce: 7,
    });

    expect(result['dry-run']).toBe(true);
    expect(result['gas-limit']).toBe('100000');
    expect(result['max-fee']).toBe('2000000000');
    expect(result.nonce).toBe(7);
  });
});

describe('resolveAccount', () => {
  it('returns a viem account for a valid private key', () => {
    const account = resolveAccount({ PRIVATE_KEY: TEST_PRIVATE_KEY });
    expect(account.address).toBeDefined();
    expect(account.type).toBe('local');
  });

  it('throws a clear error when PRIVATE_KEY is missing', () => {
    expect(() => resolveAccount({})).toThrow('Missing PRIVATE_KEY env var');
  });

  it('throws on invalid private key format', () => {
    expect(() => resolveAccount({ PRIVATE_KEY: 'not-a-key' })).toThrow();
  });
});

describe('formatTxResult', () => {
  it('formats successful tx output as json-safe values', () => {
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
      txHash: MOCK_HASH,
      blockNumber: 42,
      gasUsed: '21000',
    });
  });

  it('formats dry-run output and stringifies bigint simulation fields', () => {
    const dryRun: DryRunResult = {
      status: 'dry-run',
      estimatedGas: 50000n,
      simulationResult: {
        amountOut: 123456789n,
      },
    };

    const formatted = formatTxResult(dryRun);
    expect(formatted).toEqual({
      dryRun: true,
      estimatedGas: '50000',
      simulationResult: {
        amountOut: '123456789',
      },
    });
  });
});

describe('aboreanWriteTx', () => {
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

  it('returns normalized tx output on live execution', async () => {
    const result = await aboreanWriteTx({
      env: { PRIVATE_KEY: TEST_PRIVATE_KEY },
      options: { 'dry-run': false },
      address: MOCK_ADDRESS,
      abi: TEST_ABI as unknown as import('viem').Abi,
      functionName: 'transfer',
      args: [MOCK_ADDRESS, 1000n],
    });

    expect(result).toEqual({
      txHash: MOCK_HASH,
      blockNumber: 42,
      gasUsed: '21000',
    });
  });

  it('supports --dry-run and skips broadcast', async () => {
    (mockPublicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      30000n,
    );
    (mockPublicClient.simulateContract as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      result: { minOut: 99n },
    });

    const result = await aboreanWriteTx({
      env: { PRIVATE_KEY: TEST_PRIVATE_KEY },
      options: { 'dry-run': true },
      address: MOCK_ADDRESS,
      abi: TEST_ABI as unknown as import('viem').Abi,
      functionName: 'transfer',
      args: [MOCK_ADDRESS, 1000n],
    });

    expect(result).toEqual({
      dryRun: true,
      estimatedGas: '30000',
      simulationResult: { minOut: '99' },
    });
    expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
  });

  it('forwards gas/fee/nonce overrides', async () => {
    await aboreanWriteTx({
      env: { PRIVATE_KEY: TEST_PRIVATE_KEY },
      options: {
        'dry-run': false,
        'gas-limit': '100000',
        'max-fee': '2000000000',
        nonce: 5,
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
        nonce: 5,
      }),
    );
  });
});
