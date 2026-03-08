import { privateKeyToAccount } from 'viem/accounts';
import { TxError } from '../errors.js';
import type { TxSigner } from '../types.js';

const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

/**
 * Create a {@link TxSigner} from a raw private key.
 *
 * @param privateKey - `0x`-prefixed 32-byte hex string.
 * @returns A signer backed by `viem/accounts.privateKeyToAccount`.
 * @throws {TxError} `SIGNER_NOT_CONFIGURED` when the key format is invalid.
 */
export function createPrivateKeySigner(privateKey: string): TxSigner {
  if (!PRIVATE_KEY_REGEX.test(privateKey)) {
    throw new TxError(
      'SIGNER_NOT_CONFIGURED',
      'Invalid private key format: expected 0x-prefixed 32-byte hex string',
    );
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return { account, address: account.address, provider: 'private-key' };
}
