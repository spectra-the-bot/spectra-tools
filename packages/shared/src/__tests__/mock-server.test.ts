import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MockServer } from '../testing/mock-server.js';
import { createMockServer } from '../testing/mock-server.js';

describe('createMockServer', () => {
  let server: MockServer | undefined;

  beforeEach(async () => {
    server = await createMockServer();
  });

  afterEach(async () => {
    if (server) {
      await server.close();
      server = undefined;
    }
  });

  it('creates and starts a mock server', async () => {
    expect(server?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const response = await fetch(`${server?.url}/health`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({});

    expect(server?.requests).toHaveLength(1);
    expect(server?.requests[0]?.method).toBe('GET');
    expect(server?.requests[0]?.url).toBe('/health');
  });

  it('registers routes and responds with configured status/body/headers', async () => {
    server?.addRoute('GET', '/hello', {
      status: 201,
      headers: { 'Content-Type': 'application/json', 'X-Mock': 'yes' },
      body: { ok: true, source: 'mock' },
    });

    const response = await fetch(`${server?.url}/hello`);
    expect(response.status).toBe(201);
    expect(response.headers.get('x-mock')).toBe('yes');
    await expect(response.json()).resolves.toEqual({ ok: true, source: 'mock' });

    expect(server?.requests).toHaveLength(1);
    expect(server?.requests[0]?.method).toBe('GET');
    expect(server?.requests[0]?.url).toBe('/hello');
  });

  it('shuts down cleanly', async () => {
    const running = server;
    server = undefined;

    await running?.close();

    await expect(fetch(`${running?.url}/after-close`)).rejects.toThrow();
  });
});
