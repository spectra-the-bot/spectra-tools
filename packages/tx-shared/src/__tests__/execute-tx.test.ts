import type { Account, Address, PublicClient, TransactionReceipt, WalletClient } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TxError } from '../errors.js';
import { type DryRunResult, type ExecuteTxOptions, executeTx } from '../execute-tx.js';
import { attachPrivyPolicyContext } from '../signers/privy.js';
import type { TxResult } from '../types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' as Address;
const MOCK_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;
const MOCK_ABI = [
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

function mockReceipt(overrides?: Partial<TransactionReceipt>): TransactionReceipt {
  return {
    transactionHash: MOCK_HASH,
    blockNumber: 42n,
    gasUsed: 21000n,
    status: 'success',
    from: MOCK_ADDRESS,
    to: MOCK_ADDRESS,
    effectiveGasPrice: 1000000000n,
    blockHash:
      '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    contractAddress: null,
    cumulativeGasUsed: 21000n,
    logs: [],
    logsBloom: '0x' as `0x${string}`,
    transactionIndex: 0,
    type: 'eip1559',
    root: undefined,
    ...overrides,
  } as TransactionReceipt;
}

function createMockClients() {
  const publicClient = {
    estimateContractGas: vi.fn<() => Promise<bigint>>().mockResolvedValue(21000n),
    simulateContract: vi.fn().mockResolvedValue({ result: true }),
    waitForTransactionReceipt: vi.fn().mockResolvedValue(mockReceipt()),
  } as unknown as PublicClient;

  const walletClient = {
    writeContract: vi.fn<() => Promise<`0x${string}`>>().mockResolvedValue(MOCK_HASH),
  } as unknown as WalletClient;

  const account = { address: MOCK_ADDRESS, type: 'local' } as Account;

  return { publicClient, walletClient, account };
}

function baseOptions(
  clients: ReturnType<typeof createMockClients>,
  overrides?: Partial<ExecuteTxOptions>,
): ExecuteTxOptions {
  return {
    publicClient: clients.publicClient,
    walletClient: clients.walletClient,
    account: clients.account,
    address: MOCK_ADDRESS,
    abi: MOCK_ABI as unknown as ExecuteTxOptions['abi'],
    functionName: 'transfer',
    args: [MOCK_ADDRESS, 1000n],
    ...overrides,
  };
}

function createPrivyAccountWithPolicy(policyPayload: unknown): {
  account: Account;
  getWallet: ReturnType<typeof vi.fn>;
  getPolicy: ReturnType<typeof vi.fn>;
} {
  const getWallet = vi.fn(async () => ({
    id: 'wallet-id-1234',
    address: MOCK_ADDRESS,
    owner_id: null,
    policy_ids: ['policy-1'],
  }));

  const getPolicy = vi.fn(async (_policyId: string) => ({
    id: 'policy-1',
    owner_id: null,
    rules: [policyPayload],
  }));

  const account = attachPrivyPolicyContext({ address: MOCK_ADDRESS, type: 'json-rpc' } as Account, {
    appId: 'app-id-1234',
    walletId: 'wallet-id-1234',
    apiUrl: 'https://api.privy.io',
    client: {
      appId: 'app-id-1234',
      walletId: 'wallet-id-1234',
      apiUrl: 'https://api.privy.io',
      createRpcIntent: vi.fn(),
      getWallet,
      getPolicy,
    },
  });

  return { account, getWallet, getPolicy };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeTx', () => {
  let clients: ReturnType<typeof createMockClients>;

  beforeEach(() => {
    clients = createMockClients();
  });

  // ---- Success path -------------------------------------------------------
  describe('success path', () => {
    it('returns a TxResult with hash, block, gas, and status', async () => {
      const result = await executeTx(baseOptions(clients));

      expect(result).toEqual({
        hash: MOCK_HASH,
        blockNumber: 42n,
        gasUsed: 21000n,
        status: 'success',
        from: MOCK_ADDRESS,
        to: MOCK_ADDRESS,
        effectiveGasPrice: 1000000000n,
      } satisfies TxResult);
    });

    it('calls lifecycle methods in order: estimate → simulate → write → receipt', async () => {
      const callOrder: string[] = [];

      (clients.publicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          callOrder.push('estimate');
          return 21000n;
        },
      );
      (clients.publicClient.simulateContract as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          callOrder.push('simulate');
          return { result: true };
        },
      );
      (clients.walletClient.writeContract as ReturnType<typeof vi.fn>).mockImplementation(
        async () => {
          callOrder.push('write');
          return MOCK_HASH;
        },
      );
      (
        clients.publicClient.waitForTransactionReceipt as ReturnType<typeof vi.fn>
      ).mockImplementation(async () => {
        callOrder.push('receipt');
        return mockReceipt();
      });

      await executeTx(baseOptions(clients));
      expect(callOrder).toEqual(['estimate', 'simulate', 'write', 'receipt']);
    });

    it('passes gasLimit override to writeContract', async () => {
      await executeTx(baseOptions(clients, { gasLimit: 50000n }));

      expect(clients.walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({ gas: 50000n }),
      );
    });

    it('passes maxFeePerGas and nonce overrides to writeContract', async () => {
      await executeTx(baseOptions(clients, { maxFeePerGas: 2000000000n, nonce: 42 }));

      expect(clients.walletClient.writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          maxFeePerGas: 2000000000n,
          nonce: 42,
        }),
      );
    });
  });

  // ---- Dry-run path -------------------------------------------------------
  describe('dry-run path', () => {
    it('returns DryRunResult without calling writeContract', async () => {
      const result = await executeTx(baseOptions(clients, { dryRun: true }));

      expect(result).toEqual({
        status: 'dry-run',
        estimatedGas: 21000n,
        simulationResult: true,
      } satisfies DryRunResult);

      expect(clients.walletClient.writeContract).not.toHaveBeenCalled();
      expect(clients.publicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
    });
  });

  // ---- Privy policy preflight ---------------------------------------------
  describe('privy policy preflight', () => {
    it('blocks live submission before writeContract when policy denies contract target', async () => {
      const { account, getWallet, getPolicy } = createPrivyAccountWithPolicy({
        action: 'eth_sendTransaction',
        constraints: {
          contract_allowlist: ['0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
        },
      });

      await expect(executeTx(baseOptions(clients, { account }))).rejects.toMatchObject({
        code: 'PRIVY_POLICY_BLOCKED',
      });

      expect(getWallet).toHaveBeenCalledTimes(1);
      expect(getPolicy).toHaveBeenCalledWith('policy-1');
      expect(clients.walletClient.writeContract).not.toHaveBeenCalled();
    });

    it('includes privy policy visibility in dry-run output', async () => {
      const { account } = createPrivyAccountWithPolicy({
        action: 'eth_sendTransaction',
        constraints: {
          allowed_contracts: [MOCK_ADDRESS],
          max_value_wei: '1000',
        },
      });

      const result = await executeTx(baseOptions(clients, { account, dryRun: true, value: 99n }));

      expect(result).toMatchObject({
        status: 'dry-run',
        estimatedGas: 21000n,
        simulationResult: true,
        privyPolicy: {
          status: 'allowed',
          visibility: {
            walletId: 'wallet-id-1234',
            policyIds: ['policy-1'],
            contractAllowlist: [MOCK_ADDRESS],
            maxValueWei: 1000n,
          },
          violations: [],
        },
      });
    });
  });

  // ---- Error mappings -----------------------------------------------------
  describe('error mapping', () => {
    it('maps insufficient funds during estimation to INSUFFICIENT_FUNDS', async () => {
      (clients.publicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('insufficient funds for gas * price + value'),
      );

      await expect(executeTx(baseOptions(clients))).rejects.toThrow(TxError);
      await expect(executeTx(baseOptions(clients))).rejects.toMatchObject({
        code: 'INSUFFICIENT_FUNDS',
      });
    });

    it('maps insufficient balance during submission to INSUFFICIENT_FUNDS', async () => {
      (clients.walletClient.writeContract as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("sender doesn't have enough funds to send tx"),
      );

      await expect(executeTx(baseOptions(clients))).rejects.toThrow(TxError);
      await expect(executeTx(baseOptions(clients))).rejects.toMatchObject({
        code: 'INSUFFICIENT_FUNDS',
      });
    });

    it('maps nonce too low during submission to NONCE_CONFLICT', async () => {
      (clients.walletClient.writeContract as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('nonce too low'),
      );

      await expect(executeTx(baseOptions(clients))).rejects.toThrow(TxError);
      await expect(executeTx(baseOptions(clients))).rejects.toMatchObject({
        code: 'NONCE_CONFLICT',
      });
    });

    it('maps nonce already used to NONCE_CONFLICT', async () => {
      (clients.walletClient.writeContract as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('nonce has already been used'),
      );

      await expect(executeTx(baseOptions(clients))).rejects.toMatchObject({
        code: 'NONCE_CONFLICT',
      });
    });

    it('maps simulation failure to GAS_ESTIMATION_FAILED', async () => {
      (clients.publicClient.simulateContract as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('execution reverted: ERC20: transfer amount exceeds balance'),
      );

      await expect(executeTx(baseOptions(clients))).rejects.toThrow(TxError);
      await expect(executeTx(baseOptions(clients))).rejects.toMatchObject({
        code: 'GAS_ESTIMATION_FAILED',
      });
    });

    it('maps gas estimation failure to GAS_ESTIMATION_FAILED', async () => {
      (clients.publicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('cannot estimate gas; transaction may fail'),
      );

      await expect(executeTx(baseOptions(clients))).rejects.toThrow(TxError);
      await expect(executeTx(baseOptions(clients))).rejects.toMatchObject({
        code: 'GAS_ESTIMATION_FAILED',
      });
    });

    it('maps on-chain revert (receipt status) to TX_REVERTED', async () => {
      (
        clients.publicClient.waitForTransactionReceipt as ReturnType<typeof vi.fn>
      ).mockResolvedValue(mockReceipt({ status: 'reverted' }));

      await expect(executeTx(baseOptions(clients))).rejects.toThrow(TxError);
      await expect(executeTx(baseOptions(clients))).rejects.toMatchObject({
        code: 'TX_REVERTED',
      });
    });

    it('maps submission revert error to TX_REVERTED', async () => {
      (clients.walletClient.writeContract as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('execution reverted'),
      );

      await expect(executeTx(baseOptions(clients))).rejects.toThrow(TxError);
      await expect(executeTx(baseOptions(clients))).rejects.toMatchObject({
        code: 'TX_REVERTED',
      });
    });

    it('preserves the original error as cause', async () => {
      const original = new Error('insufficient funds for gas');
      (clients.publicClient.estimateContractGas as ReturnType<typeof vi.fn>).mockRejectedValue(
        original,
      );

      try {
        await executeTx(baseOptions(clients));
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(TxError);
        expect((err as TxError).cause).toBe(original);
      }
    });
  });
});
