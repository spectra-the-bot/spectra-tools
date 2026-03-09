import { http, type Address, createPublicClient, createWalletClient, parseAbi } from 'viem';
import {
  type SignerEnv,
  type SignerFlags,
  abstractMainnet,
  executeTx,
  resolveSigner,
  toSignerOptions,
} from '../index.js';

const REGISTRY_ABI = parseAbi(['function register() payable']);

export interface AssemblyRegisterExampleInput {
  flags: SignerFlags;
  env: SignerEnv & { ABSTRACT_RPC_URL?: string };
  registryAddress: Address;
  registrationFeeWei: bigint;
  dryRun?: boolean;
}

/**
 * Assembly-style write example:
 * 1) Resolve signer from shared flags + env
 * 2) Build contract write request
 * 3) Execute tx lifecycle (or dry-run)
 * 4) Print tx hash / receipt metadata
 */
export async function runAssemblyRegisterExample(
  input: AssemblyRegisterExampleInput,
): Promise<void> {
  const signerOptions = toSignerOptions(input.flags, input.env);
  const signer = await resolveSigner(signerOptions);

  const publicClient = createPublicClient({
    chain: abstractMainnet,
    transport: http(input.env.ABSTRACT_RPC_URL),
  });

  const walletClient = createWalletClient({
    account: signer.account,
    chain: abstractMainnet,
    transport: http(input.env.ABSTRACT_RPC_URL),
  });

  const result = await executeTx({
    publicClient,
    walletClient,
    account: signer.account,
    address: input.registryAddress,
    abi: REGISTRY_ABI,
    functionName: 'register',
    value: input.registrationFeeWei,
    dryRun: input.dryRun ?? false,
  });

  if (result.status === 'dry-run') {
    console.log(
      JSON.stringify({
        status: result.status,
        estimatedGas: result.estimatedGas.toString(),
        simulationResult: result.simulationResult,
        provider: signer.provider,
        signer: signer.address,
      }),
    );
    return;
  }

  console.log(
    JSON.stringify({
      status: result.status,
      hash: result.hash,
      blockNumber: result.blockNumber.toString(),
      gasUsed: result.gasUsed.toString(),
      from: result.from,
      to: result.to,
      provider: signer.provider,
    }),
  );
}
