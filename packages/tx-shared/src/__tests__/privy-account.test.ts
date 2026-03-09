import { describe, expect, it, vi } from 'vitest';
import { TxError } from '../errors.js';
import { createPrivyAccount } from '../signers/privy-account.js';
import { createPrivyClient } from '../signers/privy-client.js';

const VALID_PRIVY_AUTHORIZATION_KEY =
  'wallet-auth:MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgvTXNoUAp1AJufoDRET9wFxWGj8rcRxHsi8b6swUq1PWhRANCAASkH1LqVUxrZRUr76ueaPFZKa0puuwGlEYx1fo6XVNiKiYcH1R26YLOe6fDjORlXOTnwucUSROOVcrxjsMttrER';

const PRIVY_WALLET_ADDRESS = '0x1111111111111111111111111111111111111111';
const TX_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111';

describe('privy-account', () => {
  it('submits eth_sendTransaction intents and returns tx hash', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v1/wallets/wallet-id-1234')) {
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

      if (url.endsWith('/v1/intents/wallets/wallet-id-1234/rpc')) {
        expect(init?.method).toBe('POST');
        const requestBody = JSON.parse(String(init?.body));

        expect(requestBody).toEqual({
          method: 'eth_sendTransaction',
          caip2: 'eip155:2741',
          params: {
            transaction: {
              from: PRIVY_WALLET_ADDRESS,
              to: '0x2222222222222222222222222222222222222222',
              data: '0x1234',
              value: '42',
              gas_limit: '21000',
              max_fee_per_gas: '1000000000',
              max_priority_fee_per_gas: '100000000',
              nonce: 7,
              type: 2,
              chain_id: 2741,
            },
          },
        });

        return new Response(
          JSON.stringify({
            intent_id: 'intent-1',
            status: 'executed',
            action_result: {
              response_body: {
                method: 'eth_sendTransaction',
                data: {
                  hash: TX_HASH,
                },
              },
            },
          }),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    });

    const client = createPrivyClient({
      appId: 'app-id-1234',
      walletId: 'wallet-id-1234',
      authorizationKey: VALID_PRIVY_AUTHORIZATION_KEY,
      fetchImplementation: fetchMock as typeof fetch,
    });

    const account = await createPrivyAccount({ client });

    expect(account.address).toBe(PRIVY_WALLET_ADDRESS);
    expect(account.type).toBe('json-rpc');

    const hash = await account.sendTransaction({
      to: '0x2222222222222222222222222222222222222222',
      data: '0x1234',
      value: 42n,
      gas: 21000n,
      maxFeePerGas: 1_000_000_000n,
      maxPriorityFeePerGas: 100_000_000n,
      nonce: 7,
      type: 2,
      chainId: 2741,
    });

    expect(hash).toBe(TX_HASH);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps rejected intents to PRIVY_AUTH_FAILED', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/v1/wallets/wallet-id-1234')) {
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

      return new Response(
        JSON.stringify({
          intent_id: 'intent-2',
          status: 'rejected',
          dismissal_reason: 'policy denied transfer',
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

    const account = await createPrivyAccount({ client });

    await expect(
      account.sendTransaction({
        to: '0x3333333333333333333333333333333333333333',
      }),
    ).rejects.toMatchObject({
      code: 'PRIVY_AUTH_FAILED',
      message: 'Privy rpc intent intent-2 rejected: policy denied transfer',
    });
  });

  it('maps failed intents to TX_REVERTED', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/v1/wallets/wallet-id-1234')) {
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

      return new Response(
        JSON.stringify({
          intent_id: 'intent-3',
          status: 'failed',
          action_result: {
            response_body: {
              error: {
                message: 'execution reverted',
              },
            },
          },
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

    const account = await createPrivyAccount({ client });

    await expect(
      account.sendTransaction({
        to: '0x4444444444444444444444444444444444444444',
      }),
    ).rejects.toMatchObject({
      code: 'TX_REVERTED',
      message: 'Privy rpc intent intent-3 failed: execution reverted',
    });
  });

  it('throws when wallet lookup returns malformed address', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 'wallet-id-1234',
            address: 'not-an-address',
            owner_id: null,
            policy_ids: [],
          }),
          { status: 200 },
        ),
    );

    const client = createPrivyClient({
      appId: 'app-id-1234',
      walletId: 'wallet-id-1234',
      authorizationKey: VALID_PRIVY_AUTHORIZATION_KEY,
      fetchImplementation: fetchMock as typeof fetch,
    });

    await expect(createPrivyAccount({ client })).rejects.toThrow(TxError);
    await expect(createPrivyAccount({ client })).rejects.toMatchObject({
      code: 'PRIVY_TRANSPORT_FAILED',
      message: 'Privy get wallet request failed: wallet address is missing or invalid',
    });
  });
});
