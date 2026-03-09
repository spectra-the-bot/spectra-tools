import { describe, expect, it, vi } from 'vitest';
import { TxError } from '../errors.js';
import { createPrivyAccount } from '../signers/privy-account.js';
import { createPrivyClient } from '../signers/privy-client.js';

const VALID_PRIVY_AUTHORIZATION_KEY =
  'wallet-auth:MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgvTXNoUAp1AJufoDRET9wFxWGj8rcRxHsi8b6swUq1PWhRANCAASkH1LqVUxrZRUr76ueaPFZKa0puuwGlEYx1fo6XVNiKiYcH1R26YLOe6fDjORlXOTnwucUSROOVcrxjsMttrER';

const PRIVY_WALLET_ADDRESS = '0x1111111111111111111111111111111111111111';
const TX_HASH = '0x1111111111111111111111111111111111111111111111111111111111111111';
const SIGNATURE =
  '0x7f63570dc7ef00f66d27269d478573ba0f25d0d5ec4f855cb6dc42c5c2f4a6ec5de43d160a045bbf32f786f6b3afac9bcf7fbefcc5902474ed2c81f8ac2f665b1b';
const SIGNED_TRANSACTION =
  '0x02f870830ab500018459682f008506fc23ac008252089422222222222222222222222222222222222222228001c080a00f6776fbe133658291ceadf0f85fc6e4e83515a69f8f299ec52ffb62a1c1d7a6a0197b4fdf6902db4f652ca6d129ca4cf5f70995a5a77f2f3fbf2678d2f50199d0';

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

  it('signs messages with personal_sign and returns viem-compatible hex signatures', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

      expect(url.endsWith('/v1/intents/wallets/wallet-id-1234/rpc')).toBe(true);
      const requestBody = JSON.parse(String(init?.body));
      expect(requestBody).toEqual({
        method: 'personal_sign',
        params: {
          message: 'hello privy',
          encoding: 'utf-8',
        },
      });

      return new Response(
        JSON.stringify({
          intent_id: 'intent-personal-sign',
          status: 'executed',
          action_result: {
            response_body: {
              method: 'personal_sign',
              data: {
                signature: SIGNATURE,
                encoding: 'hex',
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

    const signature = await account.signMessage({
      message: 'hello privy',
    });

    expect(signature).toBe(SIGNATURE);
  });

  it('signs typed data with eth_signTypedData_v4 and normalizes bigint fields', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

      expect(url.endsWith('/v1/intents/wallets/wallet-id-1234/rpc')).toBe(true);
      const requestBody = JSON.parse(String(init?.body));
      expect(requestBody).toEqual({
        method: 'eth_signTypedData_v4',
        params: {
          typed_data: {
            domain: {
              name: 'Spectra Mail',
              version: '1',
              chainId: '2741',
            },
            types: {
              EIP712Domain: [
                { name: 'name', type: 'string' },
                { name: 'version', type: 'string' },
                { name: 'chainId', type: 'uint256' },
              ],
              Mail: [{ name: 'contents', type: 'string' }],
            },
            message: {
              contents: 'hello typed data',
            },
            primary_type: 'Mail',
          },
        },
      });

      return new Response(
        JSON.stringify({
          intent_id: 'intent-sign-typed-data',
          status: 'executed',
          action_result: {
            response_body: {
              method: 'eth_signTypedData_v4',
              data: {
                signature: SIGNATURE,
                encoding: 'hex',
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

    const signature = await account.signTypedData({
      domain: {
        name: 'Spectra Mail',
        version: '1',
        chainId: 2741n,
      },
      primaryType: 'Mail',
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
        ],
        Mail: [{ name: 'contents', type: 'string' }],
      },
      message: {
        contents: 'hello typed data',
      },
    });

    expect(signature).toBe(SIGNATURE);
  });

  it('signs transactions with eth_signTransaction and returns serialized tx hex', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

      expect(url.endsWith('/v1/intents/wallets/wallet-id-1234/rpc')).toBe(true);
      const requestBody = JSON.parse(String(init?.body));
      expect(requestBody).toEqual({
        method: 'eth_signTransaction',
        params: {
          transaction: {
            from: PRIVY_WALLET_ADDRESS,
            to: '0x2222222222222222222222222222222222222222',
            value: '1',
            gas_limit: '21000',
            max_fee_per_gas: '3000000000',
            max_priority_fee_per_gas: '1000000000',
            nonce: 5,
            type: 2,
            chain_id: 2741,
          },
        },
      });

      return new Response(
        JSON.stringify({
          intent_id: 'intent-sign-transaction',
          status: 'executed',
          action_result: {
            response_body: {
              method: 'eth_signTransaction',
              data: {
                signed_transaction: SIGNED_TRANSACTION,
                encoding: 'rlp',
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

    const signedTransaction = await account.signTransaction({
      to: '0x2222222222222222222222222222222222222222',
      value: 1n,
      gas: 21_000n,
      maxFeePerGas: 3_000_000_000n,
      maxPriorityFeePerGas: 1_000_000_000n,
      nonce: 5,
      type: 2,
      chainId: 2741,
    });

    expect(signedTransaction).toBe(SIGNED_TRANSACTION);
  });

  it('maps rejected signing intents to PRIVY_AUTH_FAILED', async () => {
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
          intent_id: 'intent-sign-rejected',
          status: 'rejected',
          dismissal_reason: 'policy denied signature',
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
      account.signMessage({
        message: 'denied message',
      }),
    ).rejects.toMatchObject({
      code: 'PRIVY_AUTH_FAILED',
      message: 'Privy rpc intent intent-sign-rejected rejected: policy denied signature',
    });
  });

  it('maps failed intents to TX_REVERTED for eth_sendTransaction', async () => {
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
