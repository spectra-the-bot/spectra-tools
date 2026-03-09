import type { Account } from 'viem';
import { zeroAddress } from 'viem';
import { TxError } from '../errors.js';
import type { TxSigner } from '../types.js';
import { type PrivyClient, createPrivyClient } from './privy-client.js';
import { normalizePrivyApiUrl, parsePrivyAuthorizationKey } from './privy-signature.js';

export interface PrivySignerOptions {
  privyAppId?: string;
  privyWalletId?: string;
  privyAuthorizationKey?: string;
  privyApiUrl?: string;
}

export interface PrivySigner extends TxSigner {
  provider: 'privy';
  privy: {
    appId: string;
    walletId: string;
    apiUrl: string;
    client: PrivyClient;
  };
}

const REQUIRED_FIELDS: Array<keyof PrivySignerOptions> = [
  'privyAppId',
  'privyWalletId',
  'privyAuthorizationKey',
];

const APP_ID_REGEX = /^[A-Za-z0-9_-]{8,128}$/;
const WALLET_ID_REGEX = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Create a Privy signer envelope with reusable transport and request-signing primitives.
 *
 * This initializes the shared client utilities used by tx-shared Privy integrations.
 * Transaction account execution is implemented in follow-up work for issue #191.
 */
export async function createPrivySigner(options: PrivySignerOptions): Promise<PrivySigner> {
  const missing = REQUIRED_FIELDS.filter((field) => {
    const value = options[field];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missing.length > 0) {
    const missingLabels = missing
      .map((field) => {
        if (field === 'privyAppId') {
          return 'PRIVY_APP_ID';
        }
        if (field === 'privyWalletId') {
          return 'PRIVY_WALLET_ID';
        }
        return 'PRIVY_AUTHORIZATION_KEY';
      })
      .join(', ');

    throw new TxError(
      'PRIVY_AUTH_FAILED',
      `Privy signer requires configuration: missing ${missingLabels}`,
    );
  }

  const appId = options.privyAppId?.trim() ?? '';
  const walletId = options.privyWalletId?.trim() ?? '';
  const authorizationKey = options.privyAuthorizationKey?.trim() ?? '';

  if (!APP_ID_REGEX.test(appId)) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_APP_ID format: expected 8-128 chars using letters, numbers, hyphen, or underscore',
    );
  }

  if (!WALLET_ID_REGEX.test(walletId)) {
    throw new TxError(
      'PRIVY_AUTH_FAILED',
      'Invalid PRIVY_WALLET_ID format: expected 8-128 chars using letters, numbers, hyphen, or underscore',
    );
  }

  parsePrivyAuthorizationKey(authorizationKey);

  const apiUrl = normalizePrivyApiUrl(options.privyApiUrl);

  const client = createPrivyClient({
    appId,
    walletId,
    authorizationKey,
    apiUrl,
  });

  const account: Account = {
    address: zeroAddress,
    type: 'json-rpc',
  };

  return {
    provider: 'privy',
    account,
    address: account.address,
    privy: {
      appId,
      walletId,
      apiUrl,
      client,
    },
  };
}
