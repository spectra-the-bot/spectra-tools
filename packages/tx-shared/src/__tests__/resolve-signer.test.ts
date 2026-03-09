import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TxError } from '../errors.js';
import { resolveSigner } from '../resolve-signer.js';

const KNOWN_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const KNOWN_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const TEST_PASSWORD = 'test123';
const PRIVY_WALLET_ADDRESS = '0x1111111111111111111111111111111111111111';
const VALID_PRIVY_AUTHORIZATION_KEY =
  'wallet-auth:MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgvTXNoUAp1AJufoDRET9wFxWGj8rcRxHsi8b6swUq1PWhRANCAASkH1LqVUxrZRUr76ueaPFZKa0puuwGlEYx1fo6XVNiKiYcH1R26YLOe6fDjORlXOTnwucUSROOVcrxjsMttrER';

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

let tempDir: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'tx-shared-resolve-signer-test-'));
});

afterAll(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function writeKeystoreFile(filename: string): string {
  const filePath = join(tempDir, filename);
  writeFileSync(filePath, JSON.stringify(TEST_KEYSTORE_JSON), 'utf-8');
  return filePath;
}

function mockPrivyWalletLookup() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/v1/wallets/')) {
      expect(init?.method ?? 'GET').toBe('GET');
      return new Response(
        JSON.stringify({
          id: 'wallet-id-1234',
          address: PRIVY_WALLET_ADDRESS,
          owner_id: null,
          policy_ids: [],
        }),
        { status: 200 },
      );
    }

    throw new Error(`Unexpected fetch url: ${url}`);
  });

  vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
  return fetchMock;
}

describe('resolveSigner', () => {
  it('uses private key when provided', async () => {
    const signer = await resolveSigner({ privateKey: KNOWN_PRIVATE_KEY });

    expect(signer.provider).toBe('private-key');
    expect(signer.address).toBe(KNOWN_ADDRESS);
  });

  it('uses keystore when private key is not provided', async () => {
    const keystorePath = writeKeystoreFile('keystore-success.json');

    const signer = await resolveSigner({
      keystorePath,
      keystorePassword: TEST_PASSWORD,
    });

    expect(signer.provider).toBe('keystore');
    expect(signer.address).toBe(KNOWN_ADDRESS);
  });

  it('prefers private key over keystore and privy', async () => {
    const signer = await resolveSigner({
      privateKey: KNOWN_PRIVATE_KEY,
      keystorePath: '/tmp/does-not-matter.json',
      keystorePassword: 'unused',
      privy: true,
      privyAppId: 'app-id-1234',
      privyWalletId: 'wallet-id-1234',
      privyAuthorizationKey: 'wallet-auth:invalid',
    });

    expect(signer.provider).toBe('private-key');
    expect(signer.address).toBe(KNOWN_ADDRESS);
  });

  it('prefers keystore over privy when private key is absent', async () => {
    const keystorePath = writeKeystoreFile('keystore-over-privy.json');

    const signer = await resolveSigner({
      keystorePath,
      keystorePassword: TEST_PASSWORD,
      privy: true,
      privyAppId: 'app-id-1234',
      privyWalletId: 'wallet-id-1234',
      privyAuthorizationKey: 'wallet-auth:invalid',
    });

    expect(signer.provider).toBe('keystore');
    expect(signer.address).toBe(KNOWN_ADDRESS);
  });

  it('throws SIGNER_NOT_CONFIGURED when keystore password is missing', async () => {
    await expect(resolveSigner({ keystorePath: '/tmp/keystore.json' })).rejects.toMatchObject({
      code: 'SIGNER_NOT_CONFIGURED',
    });
  });

  it('resolves a privy signer when privy mode is enabled', async () => {
    const fetchMock = mockPrivyWalletLookup();

    const signer = await resolveSigner({
      privy: true,
      privyAppId: 'app-id-1234',
      privyWalletId: 'wallet-id-1234',
      privyAuthorizationKey: VALID_PRIVY_AUTHORIZATION_KEY,
    });

    expect(signer.provider).toBe('privy');
    expect(signer.address).toBe(PRIVY_WALLET_ADDRESS);
    expect(typeof (signer.account as { sendTransaction?: unknown }).sendTransaction).toBe(
      'function',
    );
    expect(typeof (signer.account as { signMessage?: unknown }).signMessage).toBe('function');
    expect(typeof (signer.account as { signTypedData?: unknown }).signTypedData).toBe('function');
    expect(typeof (signer.account as { signTransaction?: unknown }).signTransaction).toBe(
      'function',
    );
    expect(fetchMock).toHaveBeenCalledWith('https://api.privy.io/v1/wallets/wallet-id-1234', {
      method: 'GET',
      headers: {
        'privy-app-id': 'app-id-1234',
      },
    });
  });

  it('resolves a privy signer when privy env config is present without --privy', async () => {
    mockPrivyWalletLookup();

    const signer = await resolveSigner({
      privyAppId: 'app-id-1234',
      privyWalletId: 'wallet-id-1234',
      privyAuthorizationKey: VALID_PRIVY_AUTHORIZATION_KEY,
    });

    expect(signer.provider).toBe('privy');
    expect(signer.address).toBe(PRIVY_WALLET_ADDRESS);
  });

  it('supports overriding privy api url', async () => {
    const fetchMock = mockPrivyWalletLookup();

    const signer = await resolveSigner({
      privy: true,
      privyAppId: 'app-id-1234',
      privyWalletId: 'wallet-id-1234',
      privyAuthorizationKey: VALID_PRIVY_AUTHORIZATION_KEY,
      privyApiUrl: 'https://api.sandbox.privy.io/',
    });

    expect(signer.provider).toBe('privy');
    expect((signer as { privy: { apiUrl: string } }).privy.apiUrl).toBe(
      'https://api.sandbox.privy.io',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.sandbox.privy.io/v1/wallets/wallet-id-1234',
      {
        method: 'GET',
        headers: {
          'privy-app-id': 'app-id-1234',
        },
      },
    );
  });

  it('throws PRIVY_AUTH_FAILED when required privy fields are missing', async () => {
    await expect(
      resolveSigner({
        privy: true,
        privyAppId: 'app-id-1234',
      }),
    ).rejects.toMatchObject({
      code: 'PRIVY_AUTH_FAILED',
      message:
        'Privy signer requires configuration: missing PRIVY_WALLET_ID, PRIVY_AUTHORIZATION_KEY',
    });
  });

  it('throws PRIVY_AUTH_FAILED when authorization key is malformed', async () => {
    await expect(
      resolveSigner({
        privy: true,
        privyAppId: 'app-id-1234',
        privyWalletId: 'wallet-id-1234',
        privyAuthorizationKey: 'auth-key',
      }),
    ).rejects.toMatchObject({
      code: 'PRIVY_AUTH_FAILED',
      message:
        'Invalid PRIVY_AUTHORIZATION_KEY format: expected wallet-auth:<base64-pkcs8-p256-private-key>',
    });
  });

  it('throws SIGNER_NOT_CONFIGURED when no signer config is provided', async () => {
    await expect(resolveSigner({})).rejects.toThrow(TxError);
    await expect(resolveSigner({})).rejects.toMatchObject({
      code: 'SIGNER_NOT_CONFIGURED',
    });
  });
});
