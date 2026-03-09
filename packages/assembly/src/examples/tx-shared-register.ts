import {
  type SignerEnv,
  type SignerFlags,
  executeTx,
  resolveSigner,
  toSignerOptions,
} from '@spectratools/tx-shared';
import { registryAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient, createAssemblyWalletClient } from '../contracts/client.js';

export interface AssemblyTxSharedRegisterInput {
  signerFlags: SignerFlags;
  signerEnv: SignerEnv;
  rpcUrl?: string;
  registrationFeeWei: bigint;
  dryRun?: boolean;
}

/**
 * Reference wiring for Assembly consumers that want shared tx behavior.
 *
 * This demonstrates how a command can:
 * - map CLI signer flags/env into SignerOptions
 * - resolve signer provider via tx-shared precedence
 * - execute a contract write via executeTx
 */
export async function assemblyTxSharedRegister(input: AssemblyTxSharedRegisterInput) {
  const signer = await resolveSigner(toSignerOptions(input.signerFlags, input.signerEnv));

  const publicClient = createAssemblyPublicClient(input.rpcUrl);
  const walletClient = createAssemblyWalletClient(signer.account, input.rpcUrl);

  return executeTx({
    publicClient,
    walletClient,
    account: signer.account,
    address: ABSTRACT_MAINNET_ADDRESSES.registry,
    abi: registryAbi,
    functionName: 'register',
    value: input.registrationFeeWei,
    dryRun: input.dryRun ?? false,
  });
}
