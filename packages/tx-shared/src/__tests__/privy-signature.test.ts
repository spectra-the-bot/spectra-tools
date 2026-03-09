import { createPublicKey, generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createPrivyAuthorizationPayload,
  generatePrivyAuthorizationSignature,
  normalizePrivyApiUrl,
  parsePrivyAuthorizationKey,
  serializePrivyAuthorizationPayload,
} from '../signers/privy-signature.js';

function buildAuthorizationKey(): string {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const key = privateKey.export({ format: 'der', type: 'pkcs8' }) as Buffer;
  return `wallet-auth:${key.toString('base64')}`;
}

describe('privy-signature', () => {
  it('normalizes api urls and defaults to production endpoint', () => {
    expect(normalizePrivyApiUrl(undefined)).toBe('https://api.privy.io');
    expect(normalizePrivyApiUrl('https://api.sandbox.privy.io/')).toBe(
      'https://api.sandbox.privy.io',
    );
  });

  it('serializes payloads deterministically using canonical key ordering', () => {
    const payload = createPrivyAuthorizationPayload({
      appId: 'app-id-1234',
      method: 'POST',
      url: 'https://api.privy.io/v1/intents/wallets/wallet-id/rpc',
      idempotencyKey: 'idem-1',
      body: {
        params: {
          message: 'hello',
          encoding: 'utf-8',
          nested: {
            z: 1,
            a: 2,
          },
        },
        method: 'personal_sign',
      },
    });

    const serialized = serializePrivyAuthorizationPayload(payload);

    expect(serialized).toBe(
      '{"body":{"method":"personal_sign","params":{"encoding":"utf-8","message":"hello","nested":{"a":2,"z":1}}},"headers":{"privy-app-id":"app-id-1234","privy-idempotency-key":"idem-1"},"method":"POST","url":"https://api.privy.io/v1/intents/wallets/wallet-id/rpc","version":1}',
    );
  });

  it('generates a verifiable P-256 signature for payloads', () => {
    const authorizationKey = buildAuthorizationKey();
    const privateKey = parsePrivyAuthorizationKey(authorizationKey);
    const publicKey = createPublicKey(privateKey);

    const payload = createPrivyAuthorizationPayload({
      appId: 'app-id-1234',
      method: 'POST',
      url: 'https://api.privy.io/v1/intents/wallets/wallet-id/rpc',
      body: {
        method: 'personal_sign',
        params: {
          message: 'hello',
        },
      },
    });

    const serialized = serializePrivyAuthorizationPayload(payload);
    const signature = generatePrivyAuthorizationSignature(payload, authorizationKey);

    const verified = verify(
      'sha256',
      Buffer.from(serialized),
      publicKey,
      Buffer.from(signature, 'base64'),
    );

    expect(verified).toBe(true);
  });

  it('throws PRIVY_AUTH_FAILED when authorization key is malformed', () => {
    try {
      parsePrivyAuthorizationKey('wallet-auth:not-valid-base64');
      throw new Error('expected parsePrivyAuthorizationKey to throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'PRIVY_AUTH_FAILED',
        message:
          'Invalid PRIVY_AUTHORIZATION_KEY format: expected wallet-auth:<base64-pkcs8-p256-private-key>',
      });
    }
  });
});
