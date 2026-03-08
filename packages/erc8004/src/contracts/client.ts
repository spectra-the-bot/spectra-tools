import type { Chain } from 'viem';
import {
  type Address,
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
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

/** Resolves the reputation registry address from env or throws. */
export function getReputationRegistryAddress(env: Record<string, string | undefined>): Address {
  const addr = env.REPUTATION_REGISTRY_ADDRESS;
  if (!addr) {
    throw new Error('REPUTATION_REGISTRY_ADDRESS is not set. Export it or pass via env.');
  }
  return addr as Address;
}

/** Resolves the validation registry address from env or throws. */
export function getValidationRegistryAddress(env: Record<string, string | undefined>): Address {
  const addr = env.VALIDATION_REGISTRY_ADDRESS;
  if (!addr) {
    throw new Error('VALIDATION_REGISTRY_ADDRESS is not set. Export it or pass via env.');
  }
  return addr as Address;
}
