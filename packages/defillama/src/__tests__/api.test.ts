import { HttpError } from '@spectratools/cli-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFILLAMA_HOSTS, createDefiLlamaClient } from '../api.js';

function makeJsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('createDefiLlamaClient', () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it('creates a client with default hosts', () => {
    const client = createDefiLlamaClient();
    expect(client).toBeDefined();
    expect(client.get).toBeTypeOf('function');
  });

  it('makes GET requests to the correct host', async () => {
    const protocols = [{ id: '1', name: 'Aave', slug: 'aave' }];
    mockFetch.mockResolvedValue(makeJsonResponse(protocols));

    const client = createDefiLlamaClient({
      hosts: { api: 'http://localhost:9999' },
    });

    const result = await client.get('api', '/protocols');
    expect(result).toEqual(protocols);
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('http://localhost:9999/protocols');
  });

  it('routes to different hosts by key', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ coins: {} }));

    const client = createDefiLlamaClient({
      hosts: { coins: 'http://coins-test:8888' },
    });

    await client.get('coins', '/prices/current/ethereum:0xabc');
    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('http://coins-test:8888/prices/current/ethereum:0xabc');
  });

  it('exposes default host URLs', () => {
    expect(DEFILLAMA_HOSTS.api).toBe('https://api.llama.fi');
    expect(DEFILLAMA_HOSTS.coins).toBe('https://coins.llama.fi');
    expect(DEFILLAMA_HOSTS.yields).toBe('https://yields.llama.fi');
    expect(DEFILLAMA_HOSTS.stablecoins).toBe('https://stablecoins.llama.fi');
    expect(DEFILLAMA_HOSTS.bridges).toBe('https://bridges.llama.fi');
  });

  describe('error handling', () => {
    it('throws HttpError on 404 response', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response('Not Found', {
            status: 404,
            statusText: 'Not Found',
            headers: { 'content-type': 'text/plain' },
          }),
        ),
      );

      const client = createDefiLlamaClient({
        hosts: { api: 'http://localhost:9999' },
        requestsPerSecond: 100,
      });

      await expect(client.get('api', '/protocol/nonexistent')).rejects.toThrow(HttpError);
    });

    it('throws HttpError on 500 response', async () => {
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response('Internal Server Error', {
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'content-type': 'text/plain' },
          }),
        ),
      );

      const client = createDefiLlamaClient({
        hosts: { api: 'http://localhost:9999' },
        requestsPerSecond: 100,
      });

      await expect(client.get('api', '/protocols')).rejects.toThrow(HttpError);
    });

    it('propagates network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const client = createDefiLlamaClient({
        hosts: { api: 'http://localhost:9999' },
        requestsPerSecond: 100,
      });

      await expect(client.get('api', '/protocols')).rejects.toThrow('fetch failed');
    });
  });

  describe('retry behavior', () => {
    it('retries on transient failure then succeeds', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            new Response('Server Error', {
              status: 500,
              statusText: 'Internal Server Error',
              headers: { 'content-type': 'text/plain' },
            }),
          );
        }
        return Promise.resolve(makeJsonResponse([{ id: '1', name: 'Aave' }]));
      });

      const client = createDefiLlamaClient({
        hosts: { api: 'http://localhost:9999' },
        requestsPerSecond: 100,
      });

      const result = await client.get<unknown[]>('api', '/protocols');
      expect(result).toEqual([{ id: '1', name: 'Aave' }]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 429 rate limit response', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            new Response('Too Many Requests', {
              status: 429,
              statusText: 'Too Many Requests',
              headers: { 'content-type': 'text/plain', 'Retry-After': '1' },
            }),
          );
        }
        return Promise.resolve(makeJsonResponse({ protocols: [] }));
      });

      const client = createDefiLlamaClient({
        hosts: { api: 'http://localhost:9999' },
        requestsPerSecond: 100,
      });

      const result = await client.get('api', '/overview/fees');
      expect(result).toEqual({ protocols: [] });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws after exhausting all retries', async () => {
      // The default retry config is maxRetries: 3, so 4 total calls
      mockFetch.mockImplementation(() =>
        Promise.resolve(
          new Response('Server Error', {
            status: 500,
            statusText: 'Internal Server Error',
            headers: { 'content-type': 'text/plain' },
          }),
        ),
      );

      const client = createDefiLlamaClient({
        hosts: { api: 'http://localhost:9999' },
        requestsPerSecond: 100,
      });

      await expect(client.get('api', '/protocols')).rejects.toThrow(HttpError);
      // 1 initial + 3 retries = 4
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('rate limiter', () => {
    it('accepts custom requestsPerSecond', () => {
      // Should not throw
      const client = createDefiLlamaClient({ requestsPerSecond: 10 });
      expect(client).toBeDefined();
    });

    it('defaults requestsPerSecond to 5', () => {
      // Should not throw — just validates the constructor works
      const client = createDefiLlamaClient();
      expect(client).toBeDefined();
    });
  });
});
