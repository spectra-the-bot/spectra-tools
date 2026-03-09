import { afterEach, describe, expect, it, vi } from 'vitest';
import { cli } from '../cli.js';

async function runCli(argv: string[]): Promise<{ output: string; exitCode: number }> {
  let output = '';
  let exitCode = 0;

  await cli.serve(argv, {
    stdout: (s) => {
      output += s;
    },
    exit: (code) => {
      exitCode = code;
    },
  });

  return { output, exitCode };
}

describe('xapi timeline command pagination', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'X_BEARER_TOKEN');
    Reflect.deleteProperty(process.env, 'X_ACCESS_TOKEN');
    vi.unstubAllGlobals();
  });

  it('keeps since_id while paginating home timeline via next_token', async () => {
    const homeRequests: URL[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const requestUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const url = new URL(requestUrl);

        if (url.pathname === '/2/users/me') {
          return new Response(JSON.stringify({ data: { id: 'me-user', username: 'me' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (url.pathname === '/2/users/me-user/timelines/reverse_chronological') {
          homeRequests.push(url);

          if (homeRequests.length === 1) {
            return new Response(
              JSON.stringify({
                data: [
                  { id: '11', text: 'p1' },
                  { id: '12', text: 'p2' },
                ],
                meta: { next_token: 'next-1', result_count: 2 },
              }),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            );
          }

          return new Response(
            JSON.stringify({
              data: [{ id: '13', text: 'p3' }],
              meta: { result_count: 1 },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }

        return new Response('not found', { status: 404, statusText: 'Not Found' });
      }),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli([
      'timeline',
      'home',
      '--max-results',
      '3',
      '--since-id',
      '1900',
      '--json',
    ]);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual({
      posts: [
        { id: '11', text: 'p1' },
        { id: '12', text: 'p2' },
        { id: '13', text: 'p3' },
      ],
      count: 3,
    });

    expect(homeRequests).toHaveLength(2);
    expect(homeRequests[0]?.searchParams.get('since_id')).toBe('1900');
    expect(homeRequests[0]?.searchParams.get('max_results')).toBe('3');
    expect(homeRequests[0]?.searchParams.get('pagination_token')).toBeNull();

    expect(homeRequests[1]?.searchParams.get('since_id')).toBe('1900');
    expect(homeRequests[1]?.searchParams.get('max_results')).toBe('1');
    expect(homeRequests[1]?.searchParams.get('pagination_token')).toBe('next-1');
  });

  it('paginates mentions timeline by next_token without requiring since_id', async () => {
    const mentionRequests: URL[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const requestUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const url = new URL(requestUrl);

        if (url.pathname === '/2/users/me') {
          return new Response(JSON.stringify({ data: { id: 'me-user', username: 'me' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (url.pathname === '/2/users/me-user/mentions') {
          mentionRequests.push(url);

          if (mentionRequests.length === 1) {
            return new Response(
              JSON.stringify({
                data: [{ id: '21', text: 'm1' }],
                meta: { next_token: 'next-mentions', result_count: 1 },
              }),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            );
          }

          return new Response(
            JSON.stringify({
              data: [{ id: '22', text: 'm2' }],
              meta: { result_count: 1 },
            }),
            {
              status: 200,
              headers: { 'content-type': 'application/json' },
            },
          );
        }

        return new Response('not found', { status: 404, statusText: 'Not Found' });
      }),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli([
      'timeline',
      'mentions',
      '--max-results',
      '2',
      '--json',
    ]);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual({
      posts: [
        { id: '21', text: 'm1' },
        { id: '22', text: 'm2' },
      ],
      count: 2,
    });

    expect(mentionRequests).toHaveLength(2);
    expect(mentionRequests[0]?.searchParams.get('pagination_token')).toBeNull();
    expect(mentionRequests[0]?.searchParams.get('since_id')).toBeNull();
    expect(mentionRequests[1]?.searchParams.get('pagination_token')).toBe('next-mentions');
    expect(mentionRequests[1]?.searchParams.get('since_id')).toBeNull();
  });
});
