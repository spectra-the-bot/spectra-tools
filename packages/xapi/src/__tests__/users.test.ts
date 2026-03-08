import type { MockServer } from '@spectra-the-bot/cli-shared/testing';
import { createMockServer } from '@spectra-the-bot/cli-shared/testing';
import { createHttpClient } from '@spectra-the-bot/cli-shared/utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const MOCK_USER = {
  id: '12345',
  name: 'Jack',
  username: 'jack',
  description: 'Making something new.',
  public_metrics: {
    followers_count: 7_000_000,
    following_count: 4_000,
    tweet_count: 25_000,
    listed_count: 100,
  },
  created_at: new Date(Date.now() - 365 * 24 * 3_600_000).toISOString(),
};

describe('users API shape', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = await createMockServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('fetches user by username', async () => {
    server.addRoute('GET', '/2/users/by/username/jack', {
      body: { data: MOCK_USER },
    });

    const http = createHttpClient({ baseUrl: server.url });
    const res = await http.request<{ data: typeof MOCK_USER }>('/2/users/by/username/jack');
    expect(res.data.username).toBe('jack');
    expect(res.data.public_metrics.followers_count).toBe(7_000_000);
  });

  it('fetches user followers', async () => {
    server.addRoute('GET', '/2/users/12345/followers', {
      body: {
        data: [
          { id: '1', name: 'Alice', username: 'alice' },
          { id: '2', name: 'Bob', username: 'bob' },
        ],
        meta: { next_token: null, result_count: 2 },
      },
    });

    const http = createHttpClient({ baseUrl: server.url });
    const res = await http.request<{
      data: Array<{ username: string }>;
      meta: { result_count: number };
    }>('/2/users/12345/followers');
    expect(res.data).toHaveLength(2);
    expect(res.data[0]?.username).toBe('alice');
    expect(res.meta.result_count).toBe(2);
  });

  it('fetches user posts', async () => {
    server.addRoute('GET', '/2/users/12345/tweets', {
      body: {
        data: [
          {
            id: '100',
            text: 'Hello world',
            author_id: '12345',
            created_at: new Date().toISOString(),
          },
        ],
        meta: { result_count: 1 },
      },
    });

    const http = createHttpClient({ baseUrl: server.url });
    const res = await http.request<{ data: Array<{ id: string; text: string }> }>(
      '/2/users/12345/tweets',
    );
    expect(res.data[0]?.text).toBe('Hello world');
  });

  it('fetches user mentions', async () => {
    server.addRoute('GET', '/2/users/12345/mentions', {
      body: {
        data: [
          {
            id: '200',
            text: '@jack awesome!',
            author_id: '999',
            created_at: new Date().toISOString(),
          },
        ],
        meta: { result_count: 1 },
      },
    });

    const http = createHttpClient({ baseUrl: server.url });
    const res = await http.request<{ data: Array<{ id: string; text: string }> }>(
      '/2/users/12345/mentions',
    );
    expect(res.data[0]?.text).toBe('@jack awesome!');
  });

  it('handles empty followers list', async () => {
    server.addRoute('GET', '/2/users/99999/followers', {
      body: { data: [], meta: { result_count: 0 } },
    });

    const http = createHttpClient({ baseUrl: server.url });
    const res = await http.request<{ data: unknown[]; meta: { result_count: number } }>(
      '/2/users/99999/followers',
    );
    expect(res.data).toHaveLength(0);
    expect(res.meta.result_count).toBe(0);
  });

  it('passes query parameters for user fields', async () => {
    server.addRoute('GET', '/2/users/by/username/jack', {
      body: { data: MOCK_USER },
    });

    const http = createHttpClient({ baseUrl: server.url });
    await http.request('/2/users/by/username/jack', {
      query: { 'user.fields': 'id,name,username,description,public_metrics' },
    });

    const url = server.requests[0]?.url ?? '';
    expect(url).toContain('user.fields=');
    expect(url).toContain('username');
  });
});

describe('error handling', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = await createMockServer();
  });

  afterEach(async () => {
    await server.close();
  });

  it('throws HttpError on 404', async () => {
    server.addRoute('GET', '/2/users/by/username/notfound', {
      status: 404,
      body: { title: 'Not Found', detail: 'User not found' },
    });

    const { HttpError } = await import('@spectra-the-bot/cli-shared/utils');
    const http = createHttpClient({ baseUrl: server.url });
    await expect(http.request('/2/users/by/username/notfound')).rejects.toThrow(HttpError);
  });

  it('throws HttpError on 401 unauthorized', async () => {
    server.addRoute('GET', '/2/users/me', {
      status: 401,
      body: { title: 'Unauthorized', type: 'about:blank' },
    });

    const { HttpError } = await import('@spectra-the-bot/cli-shared/utils');
    const http = createHttpClient({ baseUrl: server.url });
    await expect(http.request('/2/users/me')).rejects.toThrow(HttpError);
  });
});
