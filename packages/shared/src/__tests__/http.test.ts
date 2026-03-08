import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MockServer } from '../testing/mock-server.js';
import { createMockServer } from '../testing/mock-server.js';
import { createHttpClient, HttpError } from '../utils/http.js';

describe('createHttpClient', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = await createMockServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('makes a GET request and returns parsed JSON', async () => {
    server.addRoute('GET', '/test', { body: { hello: 'world' } });
    const client = createHttpClient({ baseUrl: server.url });
    const result = await client.request<{ hello: string }>('/test');
    expect(result).toEqual({ hello: 'world' });
  });

  it('serializes query parameters', async () => {
    server.addRoute('GET', '/search', { body: { results: [] } });
    const client = createHttpClient({ baseUrl: server.url });
    await client.request('/search', { query: { q: 'test', limit: 10 } });
    expect(server.requests[0]?.url).toContain('q=test');
    expect(server.requests[0]?.url).toContain('limit=10');
  });

  it('sends default headers', async () => {
    server.addRoute('GET', '/api', { body: {} });
    const client = createHttpClient({
      baseUrl: server.url,
      defaultHeaders: { 'X-Api-Key': 'test-key' },
    });
    await client.request('/api');
    expect(server.requests[0]?.headers['x-api-key']).toBe('test-key');
  });

  it('does not set content-type for requests without a body', async () => {
    server.addRoute('GET', '/headers', { body: {} });
    const client = createHttpClient({ baseUrl: server.url });
    await client.request('/headers');
    expect(server.requests[0]?.headers['content-type']).toBeUndefined();
  });

  it('throws HttpError on non-2xx response', async () => {
    server.addRoute('GET', '/fail', { status: 404, body: { error: 'not found' } });
    const client = createHttpClient({ baseUrl: server.url });
    await expect(client.request('/fail')).rejects.toThrow(HttpError);
  });

  it('includes response headers in HttpError', async () => {
    server.addRoute('GET', '/rate-limit', {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '5',
      },
      body: { error: 'too many requests' },
    });
    const client = createHttpClient({ baseUrl: server.url });

    try {
      await client.request('/rate-limit');
      throw new Error('Expected request to throw HttpError');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).headers.get('retry-after')).toBe('5');
    }
  });

  it('skips null/undefined query params', async () => {
    server.addRoute('GET', '/q', { body: {} });
    const client = createHttpClient({ baseUrl: server.url });
    await client.request('/q', { query: { a: 'val', b: null, c: undefined } });
    const url = server.requests[0]?.url ?? '';
    expect(url).toContain('a=val');
    expect(url).not.toContain('b=');
    expect(url).not.toContain('c=');
  });

  it('sends POST with JSON body', async () => {
    server.addRoute('POST', '/create', { status: 201, body: { id: 1 } });
    const client = createHttpClient({ baseUrl: server.url });
    const result = await client.request<{ id: number }>('/create', {
      method: 'POST',
      body: { name: 'test' },
    });
    expect(result).toEqual({ id: 1 });
    expect(server.requests[0]?.body).toBe('{"name":"test"}');
    expect(server.requests[0]?.headers['content-type']).toBe('application/json');
  });
});
