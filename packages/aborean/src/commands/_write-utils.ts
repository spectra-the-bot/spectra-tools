import {
  type DryRunResult,
  type TxResult,
  createPrivateKeySigner,
  executeTx,
} from '@spectratools/tx-shared';
import { z } from 'incur';
import type { Abi, Address } from 'viem';
import { createAboreanPublicClient, createAboreanWalletClient } from '../contracts/client.js';
import { jsonSafe } from './_common.js';

const PRIVATE_KEY_MISSING_MESSAGE =
  'Missing PRIVATE_KEY env var. Set PRIVATE_KEY to a 0x-prefixed 32-byte hex private key.';

export const writeEnv = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
  PRIVATE_KEY: z
    .string()
    .min(1, PRIVATE_KEY_MISSING_MESSAGE)
    .describe('Private key (0x-prefixed 32-byte hex) for signing transactions'),
});

export const writeOptions = z.object({
  'dry-run': z.boolean().default(false).describe('Simulate the transaction without broadcasting'),
  'gas-limit': z.string().optional().describe('Gas limit override (in gas units)'),
  'max-fee': z.string().optional().describe('Max fee per gas override in wei (EIP-1559)'),
  nonce: z.number().optional().describe('Nonce override'),
});

export function resolveAccount(env: { PRIVATE_KEY?: string }) {
  const privateKey = env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error(PRIVATE_KEY_MISSING_MESSAGE);
  }

  const signer = createPrivateKeySigner(privateKey);
  return signer.account;
}

export type FormattedWriteTxResult = {
  txHash: string;
  blockNumber: number;
  gasUsed: string;
};

export type FormattedWriteDryRunResult = {
  dryRun: true;
  estimatedGas: string;
  simulationResult: unknown;
  privyPolicy?: unknown;
};

export function formatTxResult(
  result: TxResult | DryRunResult,
): FormattedWriteTxResult | FormattedWriteDryRunResult {
  if (result.status === 'dry-run') {
    return {
      dryRun: true,
      estimatedGas: result.estimatedGas.toString(),
      simulationResult: jsonSafe(result.simulationResult),
      ...(result.privyPolicy !== undefined ? { privyPolicy: jsonSafe(result.privyPolicy) } : {}),
    };
  }

  return {
    txHash: result.hash,
    blockNumber: Number(result.blockNumber),
    gasUsed: result.gasUsed.toString(),
  };
}

export interface AboreanWriteTxOptions {
  env: z.infer<typeof writeEnv>;
  options: z.infer<typeof writeOptions>;
  address: Address;
  abi: Abi;
  functionName: string;
  args?: unknown[];
  value?: bigint;
}

export async function aboreanWriteTx(
  opts: AboreanWriteTxOptions,
): Promise<FormattedWriteTxResult | FormattedWriteDryRunResult> {
  const { env, options, address, abi, functionName, args, value } = opts;

  const account = resolveAccount(env);
  const publicClient = createAboreanPublicClient(env.ABSTRACT_RPC_URL);
  const walletClient = createAboreanWalletClient(account, env.ABSTRACT_RPC_URL);

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
