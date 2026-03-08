import { describe, expect, it } from 'vitest';
import { TxError } from '../errors.js';
import { createPrivateKeySigner } from '../signers/private-key.js';

// Hardhat account #0 — deterministic address derivation
const KNOWN_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const KNOWN_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

describe('createPrivateKeySigner', () => {
  it('returns a TxSigner with the correct address', () => {
    const signer = createPrivateKeySigner(KNOWN_PRIVATE_KEY);

    expect(signer.address).toBe(KNOWN_ADDRESS);
    expect(signer.provider).toBe('private-key');
    expect(signer.account).toBeDefined();
    expect(signer.account.address).toBe(KNOWN_ADDRESS);
  });

  it('returns an account that can sign messages', () => {
    const signer = createPrivateKeySigner(KNOWN_PRIVATE_KEY);

    // viem local accounts expose signMessage, signTransaction, etc.
    expect(typeof signer.account.signMessage).toBe('function');
    expect(typeof signer.account.signTransaction).toBe('function');
  });

  it('throws SIGNER_NOT_CONFIGURED for key without 0x prefix', () => {
    const rawKey = KNOWN_PRIVATE_KEY.slice(2); // remove 0x

    expect(() => createPrivateKeySigner(rawKey)).toThrow(TxError);
    expect(() => createPrivateKeySigner(rawKey)).toThrow('Invalid private key format');

    try {
      createPrivateKeySigner(rawKey);
    } catch (err) {
      expect((err as TxError).code).toBe('SIGNER_NOT_CONFIGURED');
    }
  });

  it('throws SIGNER_NOT_CONFIGURED for key that is too short', () => {
    expect(() => createPrivateKeySigner('0xdead')).toThrow(TxError);

    try {
      createPrivateKeySigner('0xdead');
    } catch (err) {
      expect((err as TxError).code).toBe('SIGNER_NOT_CONFIGURED');
    }
  });

  it('throws SIGNER_NOT_CONFIGURED for key that is too long', () => {
    const tooLong = `${KNOWN_PRIVATE_KEY}ff`;

    expect(() => createPrivateKeySigner(tooLong)).toThrow(TxError);

    try {
      createPrivateKeySigner(tooLong);
    } catch (err) {
      expect((err as TxError).code).toBe('SIGNER_NOT_CONFIGURED');
    }
  });

  it('throws SIGNER_NOT_CONFIGURED for key with non-hex characters', () => {
    const badKey = '0xZZ0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    expect(() => createPrivateKeySigner(badKey)).toThrow(TxError);

    try {
      createPrivateKeySigner(badKey);
    } catch (err) {
      expect((err as TxError).code).toBe('SIGNER_NOT_CONFIGURED');
    }
  });

  it('throws SIGNER_NOT_CONFIGURED for empty string', () => {
    expect(() => createPrivateKeySigner('')).toThrow(TxError);

    try {
      createPrivateKeySigner('');
    } catch (err) {
      expect((err as TxError).code).toBe('SIGNER_NOT_CONFIGURED');
    }
  });
});
