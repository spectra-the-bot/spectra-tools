import type {
  Abi,
  Account,
  Address,
  Chain,
  PublicClient,
  TransactionReceipt,
  WalletClient,
} from 'viem';
import { TxError } from './errors.js';
import {
  type PrivyPolicyPreflightResult,
  preflightPrivyTransactionPolicy,
  toPrivyPolicyViolationError,
} from './signers/privy-client.js';
import { getPrivyPolicyContext } from './signers/privy.js';
import type { TxResult } from './types.js';

/** Options for the {@link executeTx} lifecycle. */
export interface ExecuteTxOptions {
  /** Viem public client used for gas estimation, simulation, and receipt retrieval. */
  publicClient: PublicClient;
  /** Viem wallet client used to submit the transaction. */
  walletClient: WalletClient;
  /** Signer account. */
  account: Account;
  /** Target contract address. */
  address: Address;
  /** Contract ABI (must include the target function). */
  abi: Abi;
  /** Name of the contract function to call. */
  functionName: string;
  /** Optional chain to use for the transaction. */
  chain?: Chain;
  /** Arguments passed to the contract function. */
  args?: unknown[];
  /** Native value (in wei) to send with the transaction. */
  value?: bigint;
  /** Gas limit override. When provided the estimate is still performed but this value is used for submission. */
  gasLimit?: bigint;
  /** Max fee per gas override (EIP-1559). */
  maxFeePerGas?: bigint;
  /** Nonce override. */
  nonce?: number;
  /**
   * When `true` the transaction is simulated but **not** broadcast.
   * Returns a {@link DryRunResult} instead of a {@link TxResult}.
   */
  dryRun?: boolean;
}

/** Result returned when `dryRun` is `true`. */
export interface DryRunResult {
  /** Discriminator — always `'dry-run'` for dry-run results. */
  status: 'dry-run';
  /** Estimated gas units for the call. */
  estimatedGas: bigint;
  /** Simulated return value from `simulateContract`. */
  simulationResult: unknown;
  /** Optional Privy policy visibility for Privy-backed accounts. */
  privyPolicy?: PrivyPolicyPreflightResult;
}

/**
 * Execute a full transaction lifecycle:
 *
 * 1. **Estimate** gas via `publicClient.estimateContractGas`.
 * 2. **Simulate** contract call via `publicClient.simulateContract`.
 * 3. **Preflight** Privy policies when a Privy-backed account is used.
 *    - If `dryRun` is `true`, return a {@link DryRunResult} without broadcasting.
 * 4. **Submit** the transaction via `walletClient.writeContract`.
 * 5. **Wait** for the receipt via `publicClient.waitForTransactionReceipt`.
 * 6. **Normalize** the receipt into a {@link TxResult}.
 *
 * Errors thrown by viem are mapped to structured {@link TxError} codes:
 * - `INSUFFICIENT_FUNDS` — sender lacks balance for value + gas.
 * - `NONCE_CONFLICT` — nonce already used or too low.
 * - `GAS_ESTIMATION_FAILED` — gas estimation or simulation reverted.
 * - `TX_REVERTED` — on-chain revert (includes reason when available).
 * - `PRIVY_POLICY_BLOCKED` — Privy policy preflight determined the tx is not allowed.
 */
export async function executeTx(options: ExecuteTxOptions): Promise<TxResult | DryRunResult> {
  const {
    publicClient,
    walletClient,
    account,
    address,
    abi,
    functionName,
    chain,
    args,
    value,
    gasLimit,
    maxFeePerGas,
    nonce,
    dryRun = false,
  } = options;

  // --- 1. Estimate gas ---
  let estimatedGas: bigint;
  try {
    estimatedGas = await publicClient.estimateContractGas({
      account,
      address,
      abi,
      functionName,
      args,
      value,
    } as Parameters<PublicClient['estimateContractGas']>[0]);
  } catch (error: unknown) {
    throw mapError(error, 'estimation');
  }

  // --- 2. Simulate ---
  let simulationResult: unknown;
  try {
    const sim = await publicClient.simulateContract({
      account,
      address,
      abi,
      functionName,
      args,
      value,
    } as Parameters<PublicClient['simulateContract']>[0]);
    simulationResult = sim.result;
  } catch (error: unknown) {
    throw mapError(error, 'simulation');
  }

  // --- 3. Privy preflight (if applicable) ---
  const privyPolicy = await runPrivyPolicyPreflight({
    account,
    address,
    ...(value !== undefined ? { value } : {}),
  });

  // --- Dry-run exit ---
  if (dryRun) {
    return {
      status: 'dry-run',
      estimatedGas,
      simulationResult,
      ...(privyPolicy !== undefined ? { privyPolicy } : {}),
    } satisfies DryRunResult;
  }

  if (privyPolicy?.status === 'blocked') {
    throw toPrivyPolicyViolationError(privyPolicy);
  }

  // --- 4. Submit ---
  let hash: `0x${string}`;
  try {
    hash = await walletClient.writeContract({
      account,
      address,
      abi,
      functionName,
      args,
      value,
      chain,
      gas: gasLimit ?? estimatedGas,
      maxFeePerGas,
      nonce,
    } as Parameters<WalletClient['writeContract']>[0]);
  } catch (error: unknown) {
    throw mapError(error, 'submit');
  }

  // --- 5. Wait for receipt ---
  let receipt: TransactionReceipt;
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash });
  } catch (error: unknown) {
    throw mapError(error, 'receipt');
  }

  // --- 6. Normalize ---
  if (receipt.status === 'reverted') {
    throw new TxError('TX_REVERTED', `Transaction ${hash} reverted on-chain`);
  }

  return receiptToTxResult(receipt);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function receiptToTxResult(receipt: TransactionReceipt): TxResult {
  return {
    hash: receipt.transactionHash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed,
    status: receipt.status === 'success' ? 'success' : 'reverted',
    from: receipt.from,
    to: receipt.to,
    effectiveGasPrice: receipt.effectiveGasPrice,
  };
}

type Phase = 'estimation' | 'simulation' | 'submit' | 'receipt';

interface PrivyPolicyPreflightRequest {
  account: Account;
  address: Address;
  value?: bigint;
}

async function runPrivyPolicyPreflight(
  request: PrivyPolicyPreflightRequest,
): Promise<PrivyPolicyPreflightResult | undefined> {
  const context = getPrivyPolicyContext(request.account);
  if (context === undefined) {
    return undefined;
  }

  return preflightPrivyTransactionPolicy(context.client, {
    to: request.address,
    ...(request.value !== undefined ? { value: request.value } : {}),
  });
}

function mapError(error: unknown, phase: Phase): TxError {
  const msg = errorMessage(error);

  if (matchesInsufficientFunds(msg)) {
    return new TxError('INSUFFICIENT_FUNDS', `Insufficient funds: ${msg}`, error);
  }

  if (matchesNonceConflict(msg)) {
    return new TxError('NONCE_CONFLICT', `Nonce conflict: ${msg}`, error);
  }

  if (phase === 'estimation' || phase === 'simulation') {
    return new TxError('GAS_ESTIMATION_FAILED', `Gas estimation/simulation failed: ${msg}`, error);
  }

  if (matchesRevert(msg)) {
    return new TxError('TX_REVERTED', `Transaction reverted: ${msg}`, error);
  }

  // Fallback for submit/receipt phase errors that don't match a specific pattern.
  return new TxError('TX_REVERTED', `Transaction failed (${phase}): ${msg}`, error);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function matchesInsufficientFunds(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('insufficient funds') ||
    lower.includes('insufficient balance') ||
    lower.includes("sender doesn't have enough funds")
  );
}

function matchesNonceConflict(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('nonce too low') ||
    lower.includes('nonce has already been used') ||
    lower.includes('already known') ||
    lower.includes('replacement transaction underpriced')
  );
}

function matchesRevert(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('revert') ||
    lower.includes('execution reverted') ||
    lower.includes('transaction failed')
  );
}
