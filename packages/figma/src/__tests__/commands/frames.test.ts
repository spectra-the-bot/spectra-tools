import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cli } from '../../cli.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function makeBinaryResponse(bytes: number[], status = 200): Response {
  return new Response(new Uint8Array(bytes), {
    status,
    headers: { 'content-type': 'image/png' },
  });
}

async function runCli(
  argv: string[],
  responses: Response[],
): Promise<{
  output: string;
  exitCode: number;
  fetchCalls: [string, RequestInit][];
}> {
  const callIndex = { value: 0 };
  const fetchCalls: [string, RequestInit][] = [];
  const mockFetch = vi.fn<typeof fetch>(async (input, init) => {
    fetchCalls.push([input as string, init as RequestInit]);
    const resp = responses[callIndex.value] ?? makeJsonResponse({ error: 'no mock' }, 500);
    callIndex.value++;
    return resp;
  });
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
  return { output, exitCode, fetchCalls };
}

const MOCK_FILE_WITH_FRAMES = {
  name: 'Test Design',
  lastModified: '2026-03-01T00:00:00Z',
  version: '1',
  document: {
    children: [
      {
        id: '0:1',
        name: 'Page 1',
        type: 'CANVAS',
        children: [
          {
            id: '1:2',
            name: 'Hero Frame',
            type: 'FRAME',
            absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
          },
          {
            id: '1:3',
            name: 'Footer Frame',
            type: 'FRAME',
            absoluteBoundingBox: { x: 0, y: 900, width: 1440, height: 200 },
          },
          {
            id: '1:4',
            name: 'Icon Group',
            type: 'GROUP',
            children: [],
          },
        ],
      },
      {
        id: '0:2',
        name: 'Page 2',
        type: 'CANVAS',
        children: [
          {
            id: '2:1',
            name: 'Settings Frame',
            type: 'FRAME',
            absoluteBoundingBox: { x: 0, y: 0, width: 800, height: 600 },
          },
        ],
      },
    ],
  },
};

describe('figma frames export', () => {
  beforeEach(() => {
    process.env.FIGMA_API_KEY = 'test-figma-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'FIGMA_API_KEY');
    vi.unstubAllGlobals();
  });

  it('lists all top-level frames with name, nodeId, page, dimensions', async () => {
    const { output, exitCode } = await runCli(
      ['frames', 'export', 'fileABC', '--json'],
      [makeJsonResponse(MOCK_FILE_WITH_FRAMES)],
    );

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.total).toBe(3);
    expect(parsed.frames[0]).toEqual({
      name: 'Hero Frame',
      nodeId: '1:2',
      page: 'Page 1',
      width: 1440,
      height: 900,
    });
    expect(parsed.frames[1]).toEqual({
      name: 'Footer Frame',
      nodeId: '1:3',
      page: 'Page 1',
      width: 1440,
      height: 200,
    });
    expect(parsed.frames[2]).toEqual({
      name: 'Settings Frame',
      nodeId: '2:1',
      page: 'Page 2',
      width: 800,
      height: 600,
    });
  });

  it('filters frames by --page', async () => {
    const { output, exitCode } = await runCli(
      ['frames', 'export', 'fileABC', '--page', 'Page 2', '--json'],
      [makeJsonResponse(MOCK_FILE_WITH_FRAMES)],
    );

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.total).toBe(1);
    expect(parsed.frames[0]?.name).toBe('Settings Frame');
    expect(parsed.frames[0]?.page).toBe('Page 2');
  });

  it('returns empty frames when page filter matches nothing', async () => {
    const { output, exitCode } = await runCli(
      ['frames', 'export', 'fileABC', '--page', 'Nonexistent', '--json'],
      [makeJsonResponse(MOCK_FILE_WITH_FRAMES)],
    );

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.frames).toEqual([]);
    expect(parsed.message).toContain('No frames found');
  });

  it('excludes non-FRAME nodes (GROUP, etc.)', async () => {
    const { output, exitCode } = await runCli(
      ['frames', 'export', 'fileABC', '--page', 'Page 1', '--json'],
      [makeJsonResponse(MOCK_FILE_WITH_FRAMES)],
    );

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.total).toBe(2);
    const names = parsed.frames.map((f: { name: string }) => f.name);
    expect(names).not.toContain('Icon Group');
  });

  it('outputs table format', async () => {
    const { output, exitCode } = await runCli(
      ['frames', 'export', 'fileABC', '--format', 'table'],
      [makeJsonResponse(MOCK_FILE_WITH_FRAMES)],
    );

    expect(exitCode).toBe(0);
    expect(output).toContain('Hero Frame');
    expect(output).toContain('Page 1');
  });
});

describe('figma frames render', () => {
  beforeEach(() => {
    process.env.FIGMA_API_KEY = 'test-figma-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'FIGMA_API_KEY');
    vi.unstubAllGlobals();
  });

  it('generates render URLs with correct format and scale', async () => {
    const { fetchCalls } = await runCli(
      [
        'frames',
        'render',
        'fileABC',
        '--ids',
        '1:2,1:3',
        '--image-format',
        'svg',
        '--scale',
        '3',
        '--output',
        '/tmp/figma-test-render',
        '--json',
      ],
      [
        makeJsonResponse({
          images: {
            '1:2': 'https://example.com/img1.svg',
            '1:3': 'https://example.com/img2.svg',
          },
          err: null,
        }),
        makeBinaryResponse([0x89, 0x50]),
        makeBinaryResponse([0x89, 0x51]),
      ],
    );

    const apiUrl = fetchCalls[0]?.[0] ?? '';
    expect(apiUrl).toContain('/images/fileABC');
    expect(apiUrl).toContain('format=svg');
    expect(apiUrl).toContain('scale=3');
  });

  it('downloads images sequentially and reports results', async () => {
    const downloadOrder: string[] = [];
    let callNum = 0;
    const mockFetch = vi.fn<typeof fetch>(async (input) => {
      callNum++;
      if (callNum === 1) {
        return makeJsonResponse({
          images: {
            '1:2': 'https://example.com/img1.png',
            '1:3': 'https://example.com/img2.png',
          },
          err: null,
        });
      }
      downloadOrder.push(input as string);
      return makeBinaryResponse([0x89, 0x50, 0x4e, 0x47]);
    });
    vi.stubGlobal('fetch', mockFetch);

    let output = '';
    await cli.serve(
      [
        'frames',
        'render',
        'fileABC',
        '--ids',
        '1:2,1:3',
        '--output',
        '/tmp/figma-test-seq',
        '--json',
      ],
      {
        stdout: (s) => {
          output += s;
        },
        exit: () => {},
      },
    );

    const parsed = JSON.parse(output);
    expect(parsed.rendered).toHaveLength(2);
    expect(parsed.rendered[0]?.nodeId).toBe('1:2');
    expect(parsed.rendered[1]?.nodeId).toBe('1:3');
    expect(downloadOrder).toEqual(['https://example.com/img1.png', 'https://example.com/img2.png']);
  });

  it('handles missing image URLs gracefully', async () => {
    const { output, exitCode } = await runCli(
      [
        'frames',
        'render',
        'fileABC',
        '--ids',
        '1:2,1:3',
        '--output',
        '/tmp/figma-test-missing',
        '--json',
      ],
      [
        makeJsonResponse({
          images: { '1:2': 'https://example.com/img1.png', '1:3': null },
          err: null,
        }),
        makeBinaryResponse([0x89, 0x50, 0x4e, 0x47]),
      ],
    );

    expect(exitCode).toBe(0);
    const parsed = JSON.parse(output);
    expect(parsed.rendered[0]?.size).toBeGreaterThan(0);
    expect(parsed.rendered[1]?.file).toBe('(no image)');
    expect(parsed.rendered[1]?.size).toBe(0);
  });

  it('reports API error from images endpoint', async () => {
    const { output, exitCode } = await runCli(
      ['frames', 'render', 'fileABC', '--ids', '1:2', '--output', '/tmp/figma-test-err', '--json'],
      [makeJsonResponse({ images: {}, err: 'Invalid node IDs' })],
    );

    expect(exitCode).not.toBe(0);
    expect(output).toContain('Invalid node IDs');
  });
});
