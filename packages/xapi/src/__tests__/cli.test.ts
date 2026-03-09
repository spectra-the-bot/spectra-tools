import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

describe('xapi cli command groups', () => {
  it('includes all command groups in top-level help', async () => {
    const { output, exitCode } = await runCli(['--help']);

    expect(exitCode).toBe(0);
    for (const group of ['posts', 'users', 'timeline', 'lists', 'trends', 'dm']) {
      expect(output).toContain(group);
    }
  });

  it.each(['posts', 'users', 'timeline', 'lists', 'trends', 'dm'] as const)(
    'renders %s help',
    async (group) => {
      const { output, exitCode } = await runCli([group, '--help']);
      expect(exitCode).toBe(0);
      expect(output).toContain(group);
    },
  );
});

describe('xapi cli users commands', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'X_BEARER_TOKEN');
    Reflect.deleteProperty(process.env, 'X_ACCESS_TOKEN');
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns authenticated profile for users me', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T12:00:00.000Z'));

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {
              id: '12345',
              name: 'Jack',
              username: 'jack',
              description: 'Building social software.',
              public_metrics: {
                followers_count: 10,
                following_count: 20,
                tweet_count: 30,
                listed_count: 1,
              },
              created_at: '2026-01-09T12:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli(['users', 'me', '--json']);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual({
      id: '12345',
      name: 'Jack',
      username: 'jack',
      description: 'Building social software.',
      followers: 10,
      following: 20,
      tweets: 30,
      joined: '1d ago',
    });
  });

  it('returns followers unchanged without new-only baseline mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                id: '12345',
                name: 'Jack',
                username: 'jack',
                public_metrics: {
                  followers_count: 10,
                  following_count: 20,
                  tweet_count: 30,
                  listed_count: 1,
                },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: [
                { id: '1', name: 'Alice', username: 'alice' },
                { id: '2', name: 'Bob', username: 'bob' },
              ],
              meta: { result_count: 2 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli([
      'users',
      'followers',
      'jack',
      '--max-results',
      '10',
      '--json',
    ]);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual({
      users: [
        { id: '1', name: 'Alice', username: 'alice' },
        { id: '2', name: 'Bob', username: 'bob' },
      ],
      count: 2,
    });
  });

  it('filters followers with --new-only using client-side baseline file and does not mutate file', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: {
                id: '12345',
                name: 'Jack',
                username: 'jack',
                public_metrics: {
                  followers_count: 10,
                  following_count: 20,
                  tweet_count: 30,
                  listed_count: 1,
                },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              data: [
                { id: '1', name: 'Alice', username: 'alice' },
                { id: '2', name: 'Bob', username: 'bob' },
                { id: '3', name: 'Carol', username: 'carol' },
              ],
              meta: { result_count: 3 },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        ),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const tmpDir = mkdtempSync(join(tmpdir(), 'xapi-followers-'));
    const seenIdsFile = join(tmpDir, 'seen-ids.txt');
    const baseline = '1\n2\n';
    writeFileSync(seenIdsFile, baseline, 'utf8');

    try {
      const { output, exitCode } = await runCli([
        'users',
        'followers',
        'jack',
        '--max-results',
        '10',
        '--new-only',
        '--seen-ids-file',
        seenIdsFile,
        '--json',
      ]);

      expect(exitCode).toBe(0);
      expect(JSON.parse(output)).toEqual({
        users: [{ id: '3', name: 'Carol', username: 'carol' }],
        count: 1,
      });
      expect(readFileSync(seenIdsFile, 'utf8')).toBe(baseline);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('xapi cli timeline option parsing', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'X_BEARER_TOKEN');
    Reflect.deleteProperty(process.env, 'X_ACCESS_TOKEN');
    vi.unstubAllGlobals();
  });

  it.each([
    {
      command: 'home',
      path: '/2/users/me-user/timelines/reverse_chronological',
    },
    {
      command: 'mentions',
      path: '/2/users/me-user/mentions',
    },
  ] as const)('accepts --since-id for timeline $command', async ({ command, path }) => {
    const timelineRequests: URL[] = [];

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

        if (url.pathname === path) {
          timelineRequests.push(url);
          return new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        return new Response('not found', { status: 404, statusText: 'Not Found' });
      }),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli([
      'timeline',
      command,
      '--since-id',
      '1900',
      '--json',
    ]);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual({ posts: [], count: 0 });
    expect(timelineRequests).toHaveLength(1);
    expect(timelineRequests[0]?.searchParams.get('since_id')).toBe('1900');
  });
});

describe('xapi cli write commands', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'X_BEARER_TOKEN');
    Reflect.deleteProperty(process.env, 'X_ACCESS_TOKEN');
    vi.unstubAllGlobals();
  });

  it('shows new write commands in group help output', async () => {
    const postsHelp = await runCli(['posts', '--help']);
    expect(postsHelp.exitCode).toBe(0);
    expect(postsHelp.output).toContain('like');
    expect(postsHelp.output).toContain('retweet');

    const usersHelp = await runCli(['users', '--help']);
    expect(usersHelp.exitCode).toBe(0);
    expect(usersHelp.output).toContain('follow');
    expect(usersHelp.output).toContain('unfollow');

    const listsHelp = await runCli(['lists', '--help']);
    expect(listsHelp.exitCode).toBe(0);
    expect(listsHelp.output).toContain('create');
    expect(listsHelp.output).toContain('delete');
    expect(listsHelp.output).toContain('add-member');
    expect(listsHelp.output).toContain('remove-member');
  });

  it.each([
    {
      command: 'like',
      path: '/2/users/me-user/likes',
      responseBody: { data: { liked: true } },
      expected: { liked: true, id: 'tweet-123' },
    },
    {
      command: 'retweet',
      path: '/2/users/me-user/retweets',
      responseBody: { data: { retweeted: true } },
      expected: { retweeted: true, id: 'tweet-123' },
    },
  ] as const)('returns success shape for posts $command', async (tc) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
        const requestUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const { pathname } = new URL(requestUrl);
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

        if (pathname === '/2/users/me') {
          return new Response(JSON.stringify({ data: { id: 'me-user', username: 'me' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (pathname === tc.path && method === 'POST') {
          return new Response(JSON.stringify(tc.responseBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        return new Response('not found', { status: 404, statusText: 'Not Found' });
      }),
    );

    process.env.X_ACCESS_TOKEN = 'write-token';

    const { output, exitCode } = await runCli(['posts', tc.command, 'tweet-123', '--json']);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual(tc.expected);
  });

  it.each([
    {
      command: 'follow',
      targetPath: '/2/users/me-user/following',
      method: 'POST',
      responseBody: { data: { following: true, pending_follow: false } },
      expected: { id: 'target-1', username: 'target', following: true, pending_follow: false },
    },
    {
      command: 'unfollow',
      targetPath: '/2/users/me-user/following/target-1',
      method: 'DELETE',
      responseBody: { data: { following: false } },
      expected: { id: 'target-1', username: 'target', following: false },
    },
  ] as const)('returns success shape for users $command', async (tc) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
        const requestUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const { pathname } = new URL(requestUrl);
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

        if (pathname === '/2/users/me') {
          return new Response(JSON.stringify({ data: { id: 'me-user', username: 'me' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (pathname === '/2/users/by/username/target') {
          return new Response(JSON.stringify({ data: { id: 'target-1', username: 'target' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (pathname === tc.targetPath && method === tc.method) {
          return new Response(JSON.stringify(tc.responseBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        return new Response('not found', { status: 404, statusText: 'Not Found' });
      }),
    );

    process.env.X_ACCESS_TOKEN = 'write-token';

    const { output, exitCode } = await runCli(['users', tc.command, 'target', '--json']);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual(tc.expected);
  });

  it.each([
    {
      command: ['create', '--name', 'Core devs', '--description', 'Builders only', '--private'],
      expected: { id: 'list-1', name: 'Core devs' },
      matches(pathname: string, method: string) {
        return pathname === '/2/lists' && method === 'POST';
      },
      responseBody: { data: { id: 'list-1', name: 'Core devs' } },
    },
    {
      command: ['delete', 'list-1'],
      expected: { deleted: true, id: 'list-1' },
      matches(pathname: string, method: string) {
        return pathname === '/2/lists/list-1' && method === 'DELETE';
      },
      responseBody: { data: { deleted: true } },
    },
    {
      command: ['add-member', 'list-1', 'target'],
      expected: {
        id: 'list-1',
        member_id: 'target-1',
        member_username: 'target',
        is_member: true,
      },
      matches(pathname: string, method: string) {
        return pathname === '/2/lists/list-1/members' && method === 'POST';
      },
      responseBody: { data: { is_member: true } },
    },
    {
      command: ['remove-member', 'list-1', 'target'],
      expected: {
        id: 'list-1',
        member_id: 'target-1',
        member_username: 'target',
        is_member: false,
      },
      matches(pathname: string, method: string) {
        return pathname === '/2/lists/list-1/members/target-1' && method === 'DELETE';
      },
      responseBody: { data: { is_member: false } },
    },
  ] as const)('returns success shape for lists write command', async (tc) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
        const requestUrl =
          typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const { pathname } = new URL(requestUrl);
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');

        if (pathname === '/2/users/by/username/target') {
          return new Response(JSON.stringify({ data: { id: 'target-1', username: 'target' } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        if (tc.matches(pathname, method)) {
          return new Response(JSON.stringify(tc.responseBody), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }

        return new Response('not found', { status: 404, statusText: 'Not Found' });
      }),
    );

    process.env.X_ACCESS_TOKEN = 'write-token';

    const { output, exitCode } = await runCli(['lists', ...tc.command, '--json']);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual(tc.expected);
  });

  it.each([
    { command: ['posts', 'like', 'tweet-1'], operation: 'posts like' },
    { command: ['posts', 'retweet', 'tweet-1'], operation: 'posts retweet' },
    { command: ['users', 'follow', 'target'], operation: 'users follow' },
    { command: ['users', 'unfollow', 'target'], operation: 'users unfollow' },
    { command: ['lists', 'create', '--name', 'Core devs'], operation: 'lists create' },
    { command: ['lists', 'delete', 'list-1'], operation: 'lists delete' },
    { command: ['lists', 'add-member', 'list-1', 'target'], operation: 'lists add-member' },
    {
      command: ['lists', 'remove-member', 'list-1', 'target'],
      operation: 'lists remove-member',
    },
  ] as const)('maps auth failures for $operation', async (tc) => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              detail:
                'Authenticating with OAuth 2.0 Application-Only is forbidden for this endpoint',
            }),
            {
              status: 403,
              statusText: 'Forbidden',
              headers: { 'content-type': 'application/json' },
            },
          ),
      ),
    );

    process.env.X_ACCESS_TOKEN = 'write-token';

    const { output, exitCode } = await runCli([...tc.command, '--json']);

    expect(exitCode).toBe(1);
    expect(output).toContain('INSUFFICIENT_WRITE_AUTH');
    expect(output).toContain(`operation: ${tc.operation}`);
    expect(output).toContain('required auth: X_ACCESS_TOKEN');
  });

  it.each([
    ['posts', 'like', 'tweet-1'],
    ['lists', 'delete', 'list-1'],
  ] as const)('requires X_ACCESS_TOKEN for %s %s', async (group, command, target) => {
    process.env.X_BEARER_TOKEN = 'read-token';

    const { output, exitCode } = await runCli([group, command, target, '--json']);

    expect(exitCode).toBe(1);
    expect(output).toContain('X_ACCESS_TOKEN');
  });

  it('validates list metadata for lists create', async () => {
    process.env.X_ACCESS_TOKEN = 'write-token';

    const { output, exitCode } = await runCli([
      'lists',
      'create',
      '--name',
      'x'.repeat(26),
      '--json',
    ]);

    expect(exitCode).toBe(1);
    expect(output).toContain('name');
    expect(output).toContain('expected string to have <=25 characters');
  });

  it('validates member target input for lists add-member', async () => {
    process.env.X_ACCESS_TOKEN = 'write-token';

    const { output, exitCode } = await runCli(['lists', 'add-member', 'list-1', '', '--json']);

    expect(exitCode).toBe(1);
    expect(output).toContain('member');
    expect(output).toContain('expected string to have >=1 characters');
  });
});

describe('xapi cli error and empty-result paths', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'X_BEARER_TOKEN');
    Reflect.deleteProperty(process.env, 'X_ACCESS_TOKEN');
    vi.unstubAllGlobals();
  });

  it('fails with a structured env error when auth tokens are missing', async () => {
    Reflect.deleteProperty(process.env, 'X_BEARER_TOKEN');
    Reflect.deleteProperty(process.env, 'X_ACCESS_TOKEN');

    const { output, exitCode } = await runCli(['posts', 'search', 'spectra', '--json']);

    expect(exitCode).toBe(1);
    expect(output).toContain('X_ACCESS_TOKEN or X_BEARER_TOKEN');
  });

  it('validates posts search maxResults bounds client-side', async () => {
    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli([
      'posts',
      'search',
      'spectra',
      '--maxResults',
      '3',
      '--json',
    ]);

    expect(exitCode).toBe(1);
    expect(output).toContain('maxResults');
    expect(output).toContain('expected number to be >=10');
  });

  it('returns read-auth guidance for users search with app-only bearer token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              title: 'Unsupported Authentication',
              detail:
                'Authenticating with OAuth 2.0 Application-Only is forbidden for this endpoint',
            }),
            {
              status: 403,
              statusText: 'Forbidden',
              headers: { 'content-type': 'application/json' },
            },
          ),
      ),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli(['users', 'search', 'spectra', '--json']);

    expect(exitCode).toBe(1);
    expect(output).toContain('INSUFFICIENT_READ_AUTH');
    expect(output).toContain('operation: users search');
    expect(output).toContain('X_ACCESS_TOKEN (OAuth 2.0 user token required for this endpoint)');
    expect(output).toContain(
      'x_api_detail: Authenticating with OAuth 2.0 Application-Only is forbidden for this endpoint',
    );
    expect(output).not.toContain('HTTP 403 Forbidden:');
  });

  it('parses X API detail into friendly HTTP error output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              errors: [
                {
                  parameters: { max_results: ['3'] },
                  message: 'The `max_results` query parameter value [3] is not between 10 and 100',
                },
              ],
            }),
            {
              status: 400,
              statusText: 'Bad Request',
              headers: { 'content-type': 'application/json' },
            },
          ),
      ),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli(['posts', 'get', '123', '--json']);

    expect(exitCode).toBe(1);
    expect(output).toContain('X_API_REQUEST_FAILED');
    expect(output).toContain('operation: posts get');
    expect(output).toContain('status: 400 Bad Request');
    expect(output).toContain(
      'x_api_detail: The `max_results` query parameter value [3] is not between 10 and 100',
    );
    expect(output).not.toContain('HTTP 400 Bad Request:');
  });

  it('returns empty results cleanly for posts search', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ data: [], meta: { result_count: 0 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli(['posts', 'search', 'spectra', '--json']);

    expect(exitCode).toBe(0);
    expect(JSON.parse(output)).toEqual({ posts: [], count: 0 });
  });

  it('posts search --json output does not contain CTA keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [{ id: '1', text: 'test', edit_history_tweet_ids: ['1'] }],
            meta: { result_count: 1 },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    process.env.X_BEARER_TOKEN = 'test-token';

    const { output, exitCode } = await runCli(['posts', 'search', 'spectra', '--json']);

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed).not.toHaveProperty('cta');
    expect(parsed).toHaveProperty('posts');
  });
});
