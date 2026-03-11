import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cli } from '../../cli.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function runCli(
  argv: string[],
  mockResponse: Response,
): Promise<{
  output: string;
  exitCode: number;
  calledUrl: string;
  calledBody: unknown;
}> {
  const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(mockResponse);
  vi.stubGlobal('fetch', mockFetch);

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

  const calledUrl = (mockFetch.mock.calls[0]?.[0] as string) ?? '';
  const init = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
  let calledBody: unknown = null;
  if (init?.body) {
    try {
      calledBody = JSON.parse(init.body as string);
    } catch {
      calledBody = init.body;
    }
  }

  return { output, exitCode, calledUrl, calledBody };
}

const MOCK_COMMENTS = {
  comments: [
    {
      id: 'comment-1',
      message: 'Great design!',
      created_at: '2026-03-01T12:00:00Z',
      user: { id: 'user-1', handle: 'alice' },
      order_id: '1',
    },
    {
      id: 'comment-2',
      message: 'Please fix the padding on the header section',
      created_at: '2026-03-02T09:30:00Z',
      user: { id: 'user-2', handle: 'bob' },
      order_id: '2',
      resolved_at: '2026-03-02T10:00:00Z',
      client_meta: { node_id: '1:42' },
    },
  ],
};

describe('figma comments list', () => {
  beforeEach(() => {
    process.env.FIGMA_API_KEY = 'test-figma-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'FIGMA_API_KEY');
    vi.unstubAllGlobals();
  });

  it('lists comments with author, message, date, and resolved status', async () => {
    const { output, exitCode } = await runCli(
      ['comments', 'list', 'fileABC', '--json'],
      makeJsonResponse(MOCK_COMMENTS),
    );

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.total).toBe(2);
    expect(parsed.comments[0]).toMatchObject({
      id: 'comment-1',
      author: 'alice',
      message: 'Great design!',
      resolved: false,
      nodeId: null,
    });
    expect(parsed.comments[1]).toMatchObject({
      id: 'comment-2',
      author: 'bob',
      resolved: true,
      nodeId: '1:42',
    });
  });

  it('shows empty state when no comments exist', async () => {
    const { output, exitCode } = await runCli(
      ['comments', 'list', 'fileABC', '--json'],
      makeJsonResponse({ comments: [] }),
    );

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.comments).toEqual([]);
    expect(parsed.message).toContain('No comments found');
  });

  it('outputs table format with long messages', async () => {
    const longComment = {
      comments: [
        {
          id: 'c1',
          message:
            'This is a very long comment message that should be shown in table format display',
          created_at: '2026-03-01T00:00:00Z',
          user: { id: 'u1', handle: 'eve' },
        },
      ],
    };

    const { output, exitCode } = await runCli(
      ['comments', 'list', 'fileABC', '--format', 'table'],
      makeJsonResponse(longComment),
    );

    expect(exitCode).toBe(0);
    expect(output).toContain('eve');
    expect(output).toContain('This is a very long comment');
  });

  it('calls the correct API endpoint', async () => {
    const { calledUrl } = await runCli(
      ['comments', 'list', 'myFileKey', '--json'],
      makeJsonResponse({ comments: [] }),
    );

    expect(calledUrl).toContain('/files/myFileKey/comments');
  });
});

describe('figma comments post', () => {
  beforeEach(() => {
    process.env.FIGMA_API_KEY = 'test-figma-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'FIGMA_API_KEY');
    vi.unstubAllGlobals();
  });

  it('posts a comment and returns the created comment', async () => {
    const { output, exitCode } = await runCli(
      ['comments', 'post', 'fileABC', '--message', 'Nice work!', '--json'],
      makeJsonResponse({
        id: 'new-comment-1',
        message: 'Nice work!',
        created_at: '2026-03-10T15:00:00Z',
        user: { id: 'user-1', handle: 'spectra' },
      }),
    );

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.id).toBe('new-comment-1');
    expect(parsed.message).toBe('Nice work!');
    expect(parsed.author).toBe('spectra');
    expect(parsed.permalink).toBe('https://www.figma.com/file/fileABC?comment=new-comment-1');
  });

  it('sends node-id as client_meta when --node-id is provided', async () => {
    const { calledBody } = await runCli(
      ['comments', 'post', 'fileABC', '--message', 'Fix spacing', '--node-id', '1:42', '--json'],
      makeJsonResponse({
        id: 'new-comment-2',
        message: 'Fix spacing',
        created_at: '2026-03-10T15:00:00Z',
        user: { id: 'user-1', handle: 'spectra' },
      }),
    );

    const body = calledBody as { message: string; client_meta?: { node_id: string } };
    expect(body.message).toBe('Fix spacing');
    expect(body.client_meta).toEqual({ node_id: '1:42' });
  });

  it('posts without client_meta when --node-id is omitted', async () => {
    const { calledBody } = await runCli(
      ['comments', 'post', 'fileABC', '--message', 'General feedback', '--json'],
      makeJsonResponse({
        id: 'new-comment-3',
        message: 'General feedback',
        created_at: '2026-03-10T15:00:00Z',
        user: { id: 'user-1', handle: 'spectra' },
      }),
    );

    const body = calledBody as { message: string; client_meta?: unknown };
    expect(body.message).toBe('General feedback');
    expect(body.client_meta).toBeUndefined();
  });

  it('fails with a structured env error when API key is missing', async () => {
    Reflect.deleteProperty(process.env, 'FIGMA_API_KEY');

    const { output, exitCode } = await runCli(
      ['comments', 'post', 'fileABC', '--message', 'test', '--json'],
      makeJsonResponse({}),
    );

    expect(exitCode).toBe(1);
    expect(output).toContain('FIGMA_API_KEY');
  });
});
