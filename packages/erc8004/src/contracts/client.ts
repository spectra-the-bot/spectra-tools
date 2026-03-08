import type { Chain } from 'viem';
import {
  http,
  type Address,
  type PublicClient,
  createPublicClient,
  createWalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

/** Abstract mainnet chain config */
export const abstractMainnet: Chain = {
  id: 2741,
  name: 'Abstract',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://api.mainnet.abs.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Abstract Explorer', url: 'https://abscan.org' },
  },
};

const DEFAULT_RPC = 'https://api.mainnet.abs.xyz';
const DEFAULT_CHAIN_ID = abstractMainnet.id;
const DEFAULT_IDENTITY_REGISTRY_ADDRESS: Address = '0x8004a169fb4a3325136eb29fa0ceb6d2e539a432';
const DEFAULT_REPUTATION_REGISTRY_ADDRESS: Address = '0x8004baa17c55a88189ae136b182e5fda19de9b63';
const DEFAULT_VALIDATION_REGISTRY_ADDRESS: Address = '0x8004cc8439f36fd5f9f049d9ff86523df6daab58';

/** Maximum number of contracts to include in a single multicall batch. */
export const MULTICALL_BATCH_SIZE = 100;

/** Creates a viem public client for the Abstract mainnet. */
export function getPublicClient(rpcUrl?: string): PublicClient {
  return createPublicClient({
    chain: abstractMainnet,
    transport: http(rpcUrl ?? DEFAULT_RPC),
  });
}

/** Creates a viem wallet client for write operations. */
export function getWalletClient(privateKey: string, rpcUrl?: string) {
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return createWalletClient({
    account,
    chain: abstractMainnet,
    transport: http(rpcUrl ?? DEFAULT_RPC),
  });
}

/** Resolves the identity registry address from env or throws. */
export function getIdentityRegistryAddress(env: Record<string, string | undefined>): Address {
  const addr = env.IDENTITY_REGISTRY_ADDRESS;
  if (addr) {
    return addr as Address;
  }

  const chainIdRaw = env.CHAIN_ID;
  const chainId = chainIdRaw ? Number(chainIdRaw) : DEFAULT_CHAIN_ID;

  if (chainId === abstractMainnet.id) {
    return DEFAULT_IDENTITY_REGISTRY_ADDRESS;
  }

  throw new Error('IDENTITY_REGISTRY_ADDRESS is not set. Export it or pass via env.');
}

/** Resolves the reputation registry address from flag/env/defaults or throws. */
export function getReputationRegistryAddress(
  env: Record<string, string | undefined>,
  override?: string,
): Address {
  const addr = override ?? env.REPUTATION_REGISTRY_ADDRESS;
  if (addr) {
    return addr as Address;
  }

  const chainIdRaw = env.CHAIN_ID;
  const chainId = chainIdRaw ? Number(chainIdRaw) : DEFAULT_CHAIN_ID;

  if (chainId === abstractMainnet.id) {
    return DEFAULT_REPUTATION_REGISTRY_ADDRESS;
  }

  throw new Error(
    `REPUTATION_REGISTRY_ADDRESS is required for chain ${chainId}. Set REPUTATION_REGISTRY_ADDRESS or pass --registry.`,
  );
}

/** Resolves the validation registry address from flag/env/defaults or throws. */
export function getValidationRegistryAddress(
  env: Record<string, string | undefined>,
  override?: string,
): Address {
  const addr = override ?? env.VALIDATION_REGISTRY_ADDRESS;
  if (addr) {
    return addr as Address;
  }

  const chainIdRaw = env.CHAIN_ID;
  const chainId = chainIdRaw ? Number(chainIdRaw) : DEFAULT_CHAIN_ID;

  if (chainId === abstractMainnet.id) {
    return DEFAULT_VALIDATION_REGISTRY_ADDRESS;
  }

  throw new Error(
    `VALIDATION_REGISTRY_ADDRESS is required for chain ${chainId}. Set VALIDATION_REGISTRY_ADDRESS or pass --registry.`,
  );
}
