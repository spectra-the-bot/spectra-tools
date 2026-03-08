import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TxError } from '../errors.js';
import { createKeystoreSigner } from '../signers/keystore.js';

// ---------------------------------------------------------------------------
// Test keystore — Hardhat account #0 encrypted with password "test123"
// Generated with ox Keystore.scrypt (n=2 for fast tests) + Keystore.encrypt
// ---------------------------------------------------------------------------
const TEST_PASSWORD = 'test123';
const EXPECTED_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const TEST_KEYSTORE_JSON = {
  crypto: {
    cipher: 'aes-128-ctr',
    ciphertext: '106fe5b22562a179fec180e97ddc665cafc56c6b64260a8437f73458ce5a0176',
    cipherparams: {
      iv: '69766976697669766976697669766976',
    },
    kdf: 'scrypt',
    kdfparams: {
      dklen: 32,
      n: 2,
      p: 1,
      r: 8,
      salt: '73616c7473616c7473616c7473616c74',
    },
    mac: 'fc34467d6325f3ad07a748174326f97068c68addb455522689559ddf3c1d7f87',
  },
  id: 'test-keystore',
  version: 3,
};

// ---------------------------------------------------------------------------
// Temp directory for keystore files
// ---------------------------------------------------------------------------
let tempDir: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tx-shared-keystore-test-'));
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeKeystoreFile(filename: string, content: string): string {
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('createKeystoreSigner', () => {
  it('decrypts a valid keystore and returns the correct address', () => {
    const filePath = writeKeystoreFile('valid.json', JSON.stringify(TEST_KEYSTORE_JSON));

    const signer = createKeystoreSigner({
      keystorePath: filePath,
      keystorePassword: TEST_PASSWORD,
    });

    expect(signer.address).toBe(EXPECTED_ADDRESS);
    expect(signer.provider).toBe('keystore');
    expect(signer.account).toBeDefined();
    expect(signer.account.address).toBe(EXPECTED_ADDRESS);
  });

  it('returns an account that can sign messages', () => {
    const filePath = writeKeystoreFile('valid-sign.json', JSON.stringify(TEST_KEYSTORE_JSON));

    const signer = createKeystoreSigner({
      keystorePath: filePath,
      keystorePassword: TEST_PASSWORD,
    });

    expect(typeof signer.account.signMessage).toBe('function');
    expect(typeof signer.account.signTransaction).toBe('function');
  });

  it('throws KEYSTORE_DECRYPT_FAILED for wrong password', () => {
    const filePath = writeKeystoreFile('wrong-pw.json', JSON.stringify(TEST_KEYSTORE_JSON));

    expect(() =>
      createKeystoreSigner({ keystorePath: filePath, keystorePassword: 'wrong-password' }),
    ).toThrow(TxError);

    try {
      createKeystoreSigner({ keystorePath: filePath, keystorePassword: 'wrong-password' });
    } catch (err) {
      expect((err as TxError).code).toBe('KEYSTORE_DECRYPT_FAILED');
      expect((err as TxError).message).toContain('Failed to decrypt keystore');
    }
  });

  it('throws KEYSTORE_DECRYPT_FAILED for malformed JSON', () => {
    const filePath = writeKeystoreFile('malformed.json', '{ not valid json !!!');

    expect(() =>
      createKeystoreSigner({ keystorePath: filePath, keystorePassword: TEST_PASSWORD }),
    ).toThrow(TxError);

    try {
      createKeystoreSigner({ keystorePath: filePath, keystorePassword: TEST_PASSWORD });
    } catch (err) {
      expect((err as TxError).code).toBe('KEYSTORE_DECRYPT_FAILED');
      expect((err as TxError).message).toContain('Failed to read keystore file');
    }
  });

  it('throws KEYSTORE_DECRYPT_FAILED for non-existent file', () => {
    const fakePath = join(tempDir, 'does-not-exist.json');

    expect(() =>
      createKeystoreSigner({ keystorePath: fakePath, keystorePassword: TEST_PASSWORD }),
    ).toThrow(TxError);

    try {
      createKeystoreSigner({ keystorePath: fakePath, keystorePassword: TEST_PASSWORD });
    } catch (err) {
      expect((err as TxError).code).toBe('KEYSTORE_DECRYPT_FAILED');
      expect((err as TxError).message).toContain('Failed to read keystore file');
    }
  });

  it('throws KEYSTORE_DECRYPT_FAILED for valid JSON but invalid keystore structure', () => {
    const filePath = writeKeystoreFile('bad-structure.json', JSON.stringify({ foo: 'bar' }));

    expect(() =>
      createKeystoreSigner({ keystorePath: filePath, keystorePassword: TEST_PASSWORD }),
    ).toThrow(TxError);

    try {
      createKeystoreSigner({ keystorePath: filePath, keystorePassword: TEST_PASSWORD });
    } catch (err) {
      expect((err as TxError).code).toBe('KEYSTORE_DECRYPT_FAILED');
    }
  });
});
