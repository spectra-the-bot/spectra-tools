import { describe, expect, it } from 'vitest';
import { signerEnvSchema, signerFlagSchema, toSignerOptions } from '../incur-params.js';

describe('signer flag/env schemas', () => {
  it('accepts shared signer flags', () => {
    const result = signerFlagSchema.safeParse({
      'private-key': '0xabc',
      keystore: '/tmp/keystore.json',
      password: 'pw',
      privy: true,
      'privy-api-url': 'https://api.sandbox.privy.io',
    });

    expect(result.success).toBe(true);
  });

  it('accepts shared signer env vars', () => {
    const result = signerEnvSchema.safeParse({
      PRIVATE_KEY: '0xabc',
      KEYSTORE_PASSWORD: 'pw',
      PRIVY_APP_ID: 'app-id',
      PRIVY_WALLET_ID: 'wallet-id',
      PRIVY_AUTHORIZATION_KEY: 'auth-key',
      PRIVY_API_URL: 'https://api.sandbox.privy.io',
    });

    expect(result.success).toBe(true);
  });

  it('maps flags and env to SignerOptions', () => {
    const options = toSignerOptions(
      {
        'private-key': undefined,
        keystore: '/tmp/keystore.json',
        password: undefined,
        privy: true,
        'privy-api-url': undefined,
      },
      {
        PRIVATE_KEY: '0xabc',
        KEYSTORE_PASSWORD: 'pw',
        PRIVY_APP_ID: 'app-id',
        PRIVY_WALLET_ID: 'wallet-id',
        PRIVY_AUTHORIZATION_KEY: 'auth-key',
        PRIVY_API_URL: 'https://api.sandbox.privy.io',
      },
    );

    expect(options).toEqual({
      privateKey: '0xabc',
      keystorePath: '/tmp/keystore.json',
      keystorePassword: 'pw',
      privy: true,
      privyAppId: 'app-id',
      privyWalletId: 'wallet-id',
      privyAuthorizationKey: 'auth-key',
      privyApiUrl: 'https://api.sandbox.privy.io',
    });
  });

  it('prefers flag values over env fallback for private key and password', () => {
    const options = toSignerOptions(
      {
        'private-key': '0xflag',
        keystore: '/tmp/keystore.json',
        password: 'flag-password',
        privy: false,
        'privy-api-url': 'https://api.flag.privy.io',
      },
      {
        PRIVATE_KEY: '0xenv',
        KEYSTORE_PASSWORD: 'env-password',
        PRIVY_APP_ID: undefined,
        PRIVY_WALLET_ID: undefined,
        PRIVY_AUTHORIZATION_KEY: undefined,
        PRIVY_API_URL: 'https://api.env.privy.io',
      },
    );

    expect(options.privateKey).toBe('0xflag');
    expect(options.keystorePassword).toBe('flag-password');
    expect(options.privyApiUrl).toBe('https://api.flag.privy.io');
  });

  it('maps privy env fields when privy flag remains false', () => {
    const options = toSignerOptions(
      {
        'private-key': undefined,
        keystore: undefined,
        password: undefined,
        privy: false,
        'privy-api-url': undefined,
      },
      {
        PRIVATE_KEY: undefined,
        KEYSTORE_PASSWORD: undefined,
        PRIVY_APP_ID: 'app-id',
        PRIVY_WALLET_ID: 'wallet-id',
        PRIVY_AUTHORIZATION_KEY: 'wallet-auth:base64-key',
        PRIVY_API_URL: 'https://api.env.privy.io',
      },
    );

    expect(options).toEqual({
      privyAppId: 'app-id',
      privyWalletId: 'wallet-id',
      privyAuthorizationKey: 'wallet-auth:base64-key',
      privyApiUrl: 'https://api.env.privy.io',
    });
    expect(options.privy).toBeUndefined();
  });

  it('maps explicit --privy flag even when env auth fields are unset', () => {
    const options = toSignerOptions(
      {
        'private-key': undefined,
        keystore: undefined,
        password: undefined,
        privy: true,
        'privy-api-url': undefined,
      },
      {
        PRIVATE_KEY: undefined,
        KEYSTORE_PASSWORD: undefined,
        PRIVY_APP_ID: undefined,
        PRIVY_WALLET_ID: undefined,
        PRIVY_AUTHORIZATION_KEY: undefined,
        PRIVY_API_URL: undefined,
      },
    );

    expect(options).toEqual({ privy: true });
  });
});
