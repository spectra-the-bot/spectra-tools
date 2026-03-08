import {
  type DryRunResult,
  type TxResult,
  createPrivateKeySigner,
  executeTx,
} from '@spectratools/tx-shared';
import { z } from 'incur';
import type { Abi, Address } from 'viem';
import { createAssemblyPublicClient, createAssemblyWalletClient } from '../contracts/client.js';
import { jsonSafe } from './_common.js';

/**
 * Environment variables for write commands.
 * Extends the base env with a required PRIVATE_KEY and optional RPC URL override.
 */
export const writeEnv = z.object({
  PRIVATE_KEY: z
    .string()
    .describe('Private key (0x-prefixed 32-byte hex) for signing transactions'),
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

/**
 * Shared CLI options for write commands: dry-run, gas overrides, nonce.
 */
export const writeOptions = z.object({
  'dry-run': z.boolean().default(false).describe('Simulate the transaction without broadcasting'),
  'gas-limit': z.string().optional().describe('Gas limit override (in gas units)'),
  'max-fee': z.string().optional().describe('Max fee per gas override in wei (EIP-1559)'),
  nonce: z.number().optional().describe('Nonce override'),
});

/**
 * Resolve a viem Account from the PRIVATE_KEY environment variable.
 * Uses tx-shared's `createPrivateKeySigner` for format validation.
 */
export function resolveAccount(env: { PRIVATE_KEY: string }) {
  const signer = createPrivateKeySigner(env.PRIVATE_KEY);
  return signer.account;
}

/** Formatted output for CLI display — all bigints converted to strings. */
export type FormattedTxResult = {
  status: 'success' | 'reverted';
  hash: string;
  blockNumber: number;
  gasUsed: string;
  from: string;
  to: string | null;
  effectiveGasPrice?: string;
};

/** Formatted output for dry-run display. */
export type FormattedDryRunResult = {
  status: 'dry-run';
  estimatedGas: string;
  simulationResult: unknown;
};

/**
 * Format a TxResult or DryRunResult for CLI output.
 * Converts bigints to strings and normalizes for JSON serialization.
 */
export function formatTxResult(
  result: TxResult | DryRunResult,
): FormattedTxResult | FormattedDryRunResult {
  if (result.status === 'dry-run') {
    return {
      status: 'dry-run',
      estimatedGas: result.estimatedGas.toString(),
      simulationResult: jsonSafe(result.simulationResult),
    };
  }

  return {
    status: result.status,
    hash: result.hash,
    blockNumber: Number(result.blockNumber),
    gasUsed: result.gasUsed.toString(),
    from: result.from,
    to: result.to,
    ...(result.effectiveGasPrice !== undefined
      ? { effectiveGasPrice: result.effectiveGasPrice.toString() }
      : {}),
  };
}

/** Options for {@link assemblyWriteTx}. */
export interface AssemblyWriteTxOptions {
  /** Write command environment (must include PRIVATE_KEY). */
  env: z.infer<typeof writeEnv>;
  /** Write command options (dry-run, gas overrides). */
  options: z.infer<typeof writeOptions>;
  /** Target contract address. */
  address: Address;
  /** Contract ABI. */
  abi: Abi;
  /** Contract function name. */
  functionName: string;
  /** Function arguments. */
  args?: unknown[];
  /** Native value to send (in wei). */
  value?: bigint;
}

/**
 * Orchestrate a full write transaction lifecycle for assembly commands.
 *
 * Creates public + wallet clients, resolves the signer account,
 * calls `executeTx` from tx-shared, and formats the result for CLI output.
 */
export async function assemblyWriteTx(
  opts: AssemblyWriteTxOptions,
): Promise<FormattedTxResult | FormattedDryRunResult> {
  const { env, options, address, abi, functionName, args, value } = opts;

  const account = resolveAccount(env);
  const publicClient = createAssemblyPublicClient(env.ABSTRACT_RPC_URL);
  const walletClient = createAssemblyWalletClient(account, env.ABSTRACT_RPC_URL);

  const result = await executeTx({
    publicClient,
    walletClient,
    account,
    address,
    abi,
    functionName,
    ...(args !== undefined ? { args } : {}),
    ...(value !== undefined ? { value } : {}),
    dryRun: options['dry-run'],
    ...(options['gas-limit'] ? { gasLimit: BigInt(options['gas-limit']) } : {}),
    ...(options['max-fee'] ? { maxFeePerGas: BigInt(options['max-fee']) } : {}),
    ...(options.nonce !== undefined ? { nonce: options.nonce } : {}),
  });

  return formatTxResult(result);
}
