import { TxError } from '../errors.js';
import type { TxSigner } from '../types.js';

export interface PrivySignerOptions {
  privyAppId?: string;
  privyWalletId?: string;
  privyAuthorizationKey?: string;
}

const REQUIRED_FIELDS: Array<keyof PrivySignerOptions> = [
  'privyAppId',
  'privyWalletId',
  'privyAuthorizationKey',
];

/**
 * Privy signer adapter entrypoint.
 *
 * Full Privy integration is tracked in issue #117. Until that lands,
 * this adapter provides deterministic, structured failures for callers.
 */
export async function createPrivySigner(options: PrivySignerOptions): Promise<TxSigner> {
  const missing = REQUIRED_FIELDS.filter((field) => options[field] === undefined);

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

  throw new TxError(
    'PRIVY_AUTH_FAILED',
    'Privy signer is not yet available in tx-shared. Track progress in issue #117.',
  );
}
