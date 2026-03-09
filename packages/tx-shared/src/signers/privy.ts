import type { Address } from 'viem';
import { TxError } from '../errors.js';
import { type PrivyAccount, createPrivyAccount } from './privy-account.js';
import { type PrivyClient, createPrivyClient } from './privy-client.js';
import { normalizePrivyApiUrl, parsePrivyAuthorizationKey } from './privy-signature.js';

export interface PrivySignerOptions {
  privyAppId?: string;
  privyWalletId?: string;
  privyAuthorizationKey?: string;
  privyApiUrl?: string;
}

export interface PrivyPolicyContext {
  appId: string;
  walletId: string;
  apiUrl: string;
  client: PrivyClient;
}

export interface PrivySigner {
  account: PrivyAccount;
  address: Address;
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

const PRIVY_POLICY_CONTEXT_SYMBOL = Symbol.for('spectratools.tx-shared.privy.policy-context');

/**
 * Attach Privy policy context to any account-like object so executeTx can run policy preflight checks.
 */
export function attachPrivyPolicyContext<TAccount extends object>(
  account: TAccount,
  context: PrivyPolicyContext,
): TAccount {
  Object.defineProperty(account, PRIVY_POLICY_CONTEXT_SYMBOL, {
    value: context,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  return account;
}

/** Read Privy policy context from an account when present. */
export function getPrivyPolicyContext(account: unknown): PrivyPolicyContext | undefined {
  if (typeof account !== 'object' || account === null) {
    return undefined;
  }

  const withContext = account as {
    [PRIVY_POLICY_CONTEXT_SYMBOL]?: PrivyPolicyContext;
  };

  return withContext[PRIVY_POLICY_CONTEXT_SYMBOL];
}

/**
 * Create a Privy signer envelope with reusable transport and request-signing primitives.
 *
 * The resolved account is backed by Privy RPC intents and supports:
 * - `sendTransaction` via `eth_sendTransaction`
 * - `signMessage` via `personal_sign`
 * - `signTypedData` via `eth_signTypedData_v4`
 * - `signTransaction` via `eth_signTransaction` (returns serialized tx hex; caller is responsible for broadcast)
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

  const account = attachPrivyPolicyContext(await createPrivyAccount({ client }), {
    appId,
    walletId,
    apiUrl,
    client,
  });

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
