import type { Account, Address } from 'viem';

export type SignerProvider = 'private-key' | 'keystore' | 'privy';

export interface TxSigner {
  account: Account;
  address: Address;
  provider: SignerProvider;
}

export interface TxResult {
  hash: `0x${string}`;
  blockNumber: bigint;
  gasUsed: bigint;
  status: 'success' | 'reverted';
  from: Address;
  to: Address | null;
  effectiveGasPrice?: bigint;
}

export interface SignerOptions {
  privateKey?: string;
  keystorePath?: string;
  keystorePassword?: string;
  privy?: boolean;
  privyAppId?: string;
  privyWalletId?: string;
  privyAuthorizationKey?: string;
}
