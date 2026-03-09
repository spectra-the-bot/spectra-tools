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
