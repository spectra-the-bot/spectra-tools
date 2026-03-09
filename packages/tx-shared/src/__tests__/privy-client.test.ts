import { describe, expect, it, vi } from 'vitest';
import { createPrivyClient } from '../signers/privy-client.js';

const VALID_PRIVY_AUTHORIZATION_KEY =
  'wallet-auth:MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgvTXNoUAp1AJufoDRET9wFxWGj8rcRxHsi8b6swUq1PWhRANCAASkH1LqVUxrZRUr76ueaPFZKa0puuwGlEYx1fo6XVNiKiYcH1R26YLOe6fDjORlXOTnwucUSROOVcrxjsMttrER';

describe('privy-client', () => {
  it('creates rpc intents with authorization signature headers', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe('https://api.privy.io/v1/intents/wallets/wallet-id-1234/rpc');
      expect(init?.method).toBe('POST');

      const headers = init?.headers as Record<string, string>;
      expect(headers['privy-app-id']).toBe('app-id-1234');
      expect(headers['privy-idempotency-key']).toBe('idem-123');
      expect(headers['privy-authorization-signature']).toMatch(/^[A-Za-z0-9+/=]+$/);

      return new Response(
        JSON.stringify({
          intent_id: 'intent-1',
          status: 'created',
        }),
        { status: 200 },
      );
    });

    const client = createPrivyClient({
      appId: 'app-id-1234',
      walletId: 'wallet-id-1234',
      authorizationKey: VALID_PRIVY_AUTHORIZATION_KEY,
      fetchImplementation: fetchMock as typeof fetch,
    });

    const response = await client.createRpcIntent(
      {
        method: 'personal_sign',
        params: {
          message: 'hello',
        },
      },
      { idempotencyKey: 'idem-123' },
    );

    expect(response.intent_id).toBe('intent-1');
    expect(response.status).toBe('created');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('maps authorization failures to PRIVY_AUTH_FAILED', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401 }),
    );

    const client = createPrivyClient({
      appId: 'app-id-1234',
      walletId: 'wallet-id-1234',
      authorizationKey: VALID_PRIVY_AUTHORIZATION_KEY,
      fetchImplementation: fetchMock as typeof fetch,
    });

    await expect(
      client.createRpcIntent({
        method: 'personal_sign',
        params: { message: 'hello' },
      }),
    ).rejects.toMatchObject({
      code: 'PRIVY_AUTH_FAILED',
      message: 'Privy authentication failed (401): unauthorized',
    });
  });

  it('maps network failures to PRIVY_TRANSPORT_FAILED', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('socket hang up');
    });

    const client = createPrivyClient({
      appId: 'app-id-1234',
      walletId: 'wallet-id-1234',
      authorizationKey: VALID_PRIVY_AUTHORIZATION_KEY,
      fetchImplementation: fetchMock as typeof fetch,
    });

    await expect(client.getWallet()).rejects.toMatchObject({
      code: 'PRIVY_TRANSPORT_FAILED',
      message: 'Privy get wallet request failed: network error',
    });
  });

  it('maps non-auth http failures to PRIVY_TRANSPORT_FAILED', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: 'internal error' } }), { status: 500 }),
    );

    const client = createPrivyClient({
      appId: 'app-id-1234',
      walletId: 'wallet-id-1234',
      authorizationKey: VALID_PRIVY_AUTHORIZATION_KEY,
      fetchImplementation: fetchMock as typeof fetch,
    });

    await expect(client.getPolicy('policy-id-1234')).rejects.toMatchObject({
      code: 'PRIVY_TRANSPORT_FAILED',
      message: 'Privy get policy request failed (500): internal error',
    });
  });
});
