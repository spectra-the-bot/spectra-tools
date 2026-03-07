import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Chain } from 'viem';

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
  const addr = env['IDENTITY_REGISTRY_ADDRESS'];
  if (!addr) {
    throw new Error(
      'IDENTITY_REGISTRY_ADDRESS is not set. Export it or pass via env.',
    );
  }
  return addr as Address;
}

/** Resolves the reputation registry address from env or throws. */
export function getReputationRegistryAddress(env: Record<string, string | undefined>): Address {
  const addr = env['REPUTATION_REGISTRY_ADDRESS'];
  if (!addr) {
    throw new Error(
      'REPUTATION_REGISTRY_ADDRESS is not set. Export it or pass via env.',
    );
  }
  return addr as Address;
}

/** Resolves the validation registry address from env or throws. */
export function getValidationRegistryAddress(env: Record<string, string | undefined>): Address {
  const addr = env['VALIDATION_REGISTRY_ADDRESS'];
  if (!addr) {
    throw new Error(
      'VALIDATION_REGISTRY_ADDRESS is not set. Export it or pass via env.',
    );
  }
  return addr as Address;
}
