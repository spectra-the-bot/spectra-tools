import { readFileSync } from 'node:fs';
import { Keystore } from 'ox';
import { privateKeyToAccount } from 'viem/accounts';
import { TxError } from '../errors.js';
import type { TxSigner } from '../types.js';

/** Options for {@link createKeystoreSigner}. */
export interface KeystoreSignerOptions {
  /** Path to the V3 keystore JSON file. */
  keystorePath: string;
  /** Password used to decrypt the keystore. */
  keystorePassword: string;
}

/**
 * Create a {@link TxSigner} by decrypting a V3 keystore file.
 *
 * Uses `ox` for key derivation (scrypt / pbkdf2) and AES-128-CTR decryption.
 *
 * @throws {TxError} `KEYSTORE_DECRYPT_FAILED` when the file cannot be read, parsed, or decrypted.
 */
export function createKeystoreSigner(options: KeystoreSignerOptions): TxSigner {
  const { keystorePath, keystorePassword } = options;

  // biome-ignore lint/suspicious/noExplicitAny: keystore JSON structure validated by ox at runtime
  let keystoreJson: any;
  try {
    const raw = readFileSync(keystorePath, 'utf-8');
    keystoreJson = JSON.parse(raw);
  } catch (cause) {
    throw new TxError(
      'KEYSTORE_DECRYPT_FAILED',
      `Failed to read keystore file: ${keystorePath}`,
      cause,
    );
  }

  let privateKey: string;
  try {
    const key = Keystore.toKey(keystoreJson, { password: keystorePassword });
    privateKey = Keystore.decrypt(keystoreJson, key) as string;
  } catch (cause) {
    throw new TxError(
      'KEYSTORE_DECRYPT_FAILED',
      `Failed to decrypt keystore: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    );
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return { account, address: account.address, provider: 'keystore' };
}
