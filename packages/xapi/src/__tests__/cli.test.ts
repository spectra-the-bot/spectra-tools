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
});
