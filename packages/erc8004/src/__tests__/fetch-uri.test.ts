import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRegistrationUri } from '../utils/fetch-uri.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('fetchRegistrationUri', () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    process.env.IPFS_GATEWAY = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
    process.env.IPFS_GATEWAY = '';
  });

  it('parses base64 data URIs', async () => {
    const payload = { name: 'Base64 Agent', erc8004: { version: '0.1.0' } };
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');

    const result = await fetchRegistrationUri(`data:application/json;base64,${encoded}`);

    expect(result).toEqual(payload);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('parses percent-encoded data URIs', async () => {
    const payload = { name: 'Encoded Agent', erc8004: { version: '0.1.0' } };
    const encoded = encodeURIComponent(JSON.stringify(payload));

    const result = await fetchRegistrationUri(`data:application/json,${encoded}`);

    expect(result).toEqual(payload);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('resolves ipfs:// with the default gateway', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ ok: true }));

    await fetchRegistrationUri('ipfs://bafybeigdyrzt7k2x6h5w4iv4c2m/registration.json');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ipfs.io/ipfs/bafybeigdyrzt7k2x6h5w4iv4c2m/registration.json',
    );
  });

  it('resolves ipfs:// with IPFS_GATEWAY override', async () => {
    process.env.IPFS_GATEWAY = 'https://gateway.example/';
    mockFetch.mockResolvedValue(makeJsonResponse({ ok: true }));

    await fetchRegistrationUri('ipfs://bafybeigdyrzt7k2x6h5w4iv4c2m/registration.json');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://gateway.example/ipfs/bafybeigdyrzt7k2x6h5w4iv4c2m/registration.json',
    );
  });

  it('passes through https URLs', async () => {
    const url = 'https://example.com/registration.json';
    mockFetch.mockResolvedValue(makeJsonResponse({ ok: true }));

    await fetchRegistrationUri(url);

    expect(mockFetch).toHaveBeenCalledWith(url);
  });

  it('throws on invalid data URIs', async () => {
    await expect(fetchRegistrationUri('data:application/json;base64')).rejects.toThrow(
      'Invalid data URI',
    );
  });

  it('throws on non-OK HTTP responses', async () => {
    mockFetch.mockResolvedValue(
      new Response('not found', { status: 404, statusText: 'Not Found' }),
    );

    await expect(fetchRegistrationUri('https://example.com/missing.json')).rejects.toThrow(
      'Failed to fetch URI: https://example.com/missing.json returned 404 Not Found',
    );
  });
});
