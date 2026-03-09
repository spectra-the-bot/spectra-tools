import { TxError } from './errors.js';
import {
  createKeystoreSigner,
  createPrivateKeySigner,
  createPrivySigner,
} from './signers/index.js';
import type { SignerOptions, TxSigner } from './types.js';

function hasPrivyConfig(opts: SignerOptions): boolean {
  return (
    opts.privyAppId !== undefined ||
    opts.privyWalletId !== undefined ||
    opts.privyAuthorizationKey !== undefined
  );
}

/**
 * Resolve the active signer provider using deterministic precedence:
 * private key -> keystore -> privy -> SIGNER_NOT_CONFIGURED.
 */
export async function resolveSigner(opts: SignerOptions): Promise<TxSigner> {
  if (opts.privateKey !== undefined) {
    return createPrivateKeySigner(opts.privateKey);
  }

  if (opts.keystorePath !== undefined) {
    if (opts.keystorePassword === undefined) {
      throw new TxError(
        'SIGNER_NOT_CONFIGURED',
        'Keystore password is required when --keystore is provided (use --password or KEYSTORE_PASSWORD).',
      );
    }

    return createKeystoreSigner({
      keystorePath: opts.keystorePath,
      keystorePassword: opts.keystorePassword,
    });
  }

  if (opts.privy === true || hasPrivyConfig(opts)) {
    const privySigner = await createPrivySigner({
      ...(opts.privyAppId !== undefined ? { privyAppId: opts.privyAppId } : {}),
      ...(opts.privyWalletId !== undefined ? { privyWalletId: opts.privyWalletId } : {}),
      ...(opts.privyAuthorizationKey !== undefined
        ? { privyAuthorizationKey: opts.privyAuthorizationKey }
        : {}),
      ...(opts.privyApiUrl !== undefined ? { privyApiUrl: opts.privyApiUrl } : {}),
    });

    return privySigner as unknown as TxSigner;
  }

  throw new TxError(
    'SIGNER_NOT_CONFIGURED',
    'No signer configured. Set --private-key, or --keystore + --password, or enable --privy with PRIVY_* credentials.',
  );
}
