import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const request = vi.fn();
  const createHttpClient = vi.fn(() => ({ request }));
  const withRetry = vi.fn(async <T>(fn: () => Promise<T>) => fn());
  return { request, createHttpClient, withRetry };
});

vi.mock('@spectratools/cli-shared', () => ({
  createHttpClient: mocks.createHttpClient,
  withRetry: mocks.withRetry,
}));

import { createXApiClient, relativeTime, truncateText } from '../api.js';

describe('xapi api helpers', () => {
  it('formats relative time deterministically', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T12:00:00.000Z'));

    expect(relativeTime('2026-01-10T11:59:45.000Z')).toBe('15s ago');
    expect(relativeTime('2026-01-10T11:57:00.000Z')).toBe('3m ago');
    expect(relativeTime('2026-01-10T09:00:00.000Z')).toBe('3h ago');
    expect(relativeTime('2026-01-08T12:00:00.000Z')).toBe('2d ago');

    vi.useRealTimers();
  });

  it('truncates text only when needed', () => {
    expect(truncateText('short', 10)).toBe('short');
    expect(truncateText('abcdefghij', 10)).toBe('abcdefghij');
    expect(truncateText('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefg...');
  });
});

describe('createXApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createHttpClient.mockReturnValue({ request: mocks.request });
  });

  it('creates an HTTP client with base URL and bearer token header', () => {
    createXApiClient('test-bearer');

    expect(mocks.createHttpClient).toHaveBeenCalledWith({
      baseUrl: 'https://api.x.com/2',
      defaultHeaders: {
        Authorization: 'Bearer test-bearer',
      },
    });
  });

  it('calls searchPosts with expected query fields and pagination token', async () => {
    mocks.request.mockResolvedValue({ data: [] });
    const client = createXApiClient('token');

    await client.searchPosts('typescript', 25, 'recency', 'next-123');

    expect(mocks.request).toHaveBeenCalledWith('/tweets/search/recent', {
      query: {
        query: 'typescript',
        max_results: 25,
        sort_order: 'recency',
        'tweet.fields': 'id,text,author_id,created_at,public_metrics',
        next_token: 'next-123',
      },
    });

    expect(mocks.withRetry).toHaveBeenCalledWith(expect.any(Function), {
      maxRetries: 3,
      baseMs: 500,
      maxMs: 10000,
    });
  });

  it('builds POST and DELETE requests correctly', async () => {
    mocks.request.mockResolvedValueOnce({ data: { id: '100', text: 'hello' } });
    mocks.request.mockResolvedValueOnce({ data: { deleted: true } });
    const client = createXApiClient('token');

    await client.createPost('hello', '42', '43');
    await client.deletePost('100');

    expect(mocks.request).toHaveBeenNthCalledWith(1, '/tweets', {
      method: 'POST',
      body: {
        text: 'hello',
        reply: { in_reply_to_tweet_id: '42' },
        quote_tweet_id: '43',
      },
    });

    expect(mocks.request).toHaveBeenNthCalledWith(2, '/tweets/100', {
      method: 'DELETE',
    });
  });

  it('propagates upstream API failures', async () => {
    const upstreamError = new Error('x api unavailable');
    mocks.request.mockRejectedValueOnce(upstreamError);
    const client = createXApiClient('token');

    await expect(client.getMe()).rejects.toThrow('x api unavailable');
  });
});
