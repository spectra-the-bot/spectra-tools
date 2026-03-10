import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFILLAMA_HOSTS, createDefiLlamaClient } from '../api.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
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
});
