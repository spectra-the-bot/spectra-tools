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
