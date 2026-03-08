import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EtherscanError, createEtherscanClient } from '../api.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createEtherscanClient', () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  describe('call()', () => {
    it('returns result on success', async () => {
      mockFetch.mockResolvedValue(
        makeJsonResponse({ status: '1', message: 'OK', result: '1000000000000000000' }),
      );
      const client = createEtherscanClient('test-key', 'http://localhost');
      const result = await client.call<string>({
        chainid: 1,
        module: 'account',
        action: 'balance',
        address: '0xabc',
      });
      expect(result).toBe('1000000000000000000');
    });

    it('includes apikey in query params', async () => {
      mockFetch.mockResolvedValue(makeJsonResponse({ status: '1', message: 'OK', result: '0' }));
      const client = createEtherscanClient('my-api-key', 'http://localhost');
      await client.call({ module: 'account', action: 'balance', address: '0xabc' });
      const url = (mockFetch.mock.calls[0]?.[0] as string) ?? '';
      expect(url).toContain('apikey=my-api-key');
    });

    it('throws EtherscanError when status is 0', async () => {
      mockFetch.mockResolvedValue(
        makeJsonResponse({ status: '0', message: 'NOTOK', result: 'Invalid API Key' }),
      );
      const client = createEtherscanClient('bad-key', 'http://localhost');
      await expect(
        client.call({ module: 'account', action: 'balance', address: '0xabc' }),
      ).rejects.toThrow(EtherscanError);
    });

    it('throws EtherscanError with message from result string', async () => {
      mockFetch.mockResolvedValue(
        makeJsonResponse({ status: '0', message: 'NOTOK', result: 'Rate limit exceeded' }),
      );
      const client = createEtherscanClient('key', 'http://localhost');
      await expect(client.call({})).rejects.toThrow('Rate limit exceeded');
    });

    it('includes all params in URL', async () => {
      mockFetch.mockResolvedValue(makeJsonResponse({ status: '1', message: 'OK', result: [] }));
      const client = createEtherscanClient('key', 'http://localhost');
      await client.call({ chainid: 2741, module: 'account', action: 'txlist', address: '0xabc' });
      const url = (mockFetch.mock.calls[0]?.[0] as string) ?? '';
      expect(url).toContain('chainid=2741');
      expect(url).toContain('module=account');
      expect(url).toContain('action=txlist');
    });

    it('skips undefined params', async () => {
      mockFetch.mockResolvedValue(makeJsonResponse({ status: '1', message: 'OK', result: '0' }));
      const client = createEtherscanClient('key', 'http://localhost');
      await client.call({ module: 'account', action: 'balance', contractaddress: undefined });
      const url = (mockFetch.mock.calls[0]?.[0] as string) ?? '';
      expect(url).not.toContain('contractaddress');
    });
  });

  describe('callProxy()', () => {
    it('returns result from JSON-RPC response', async () => {
      const txData = { hash: '0xabc', from: '0x1', to: '0x2', value: '0x0' };
      mockFetch.mockResolvedValue(makeJsonResponse({ jsonrpc: '2.0', id: 1, result: txData }));
      const client = createEtherscanClient('key', 'http://localhost');
      const result = await client.callProxy<typeof txData>({
        chainid: 1,
        module: 'proxy',
        action: 'eth_getTransactionByHash',
        txhash: '0xabc',
      });
      expect(result).toEqual(txData);
    });
  });
});
