import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFigmaClient } from '../api.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createFigmaClient', () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  it('sends X-Figma-Token header on every request', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        name: 'Test File',
        lastModified: '2026-01-01T00:00:00Z',
        version: '1',
        document: {},
      }),
    );

    const client = createFigmaClient('test-figma-token');
    await client.getFile('abc123');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('https://api.figma.com/v1/files/abc123');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-Figma-Token']).toBe('test-figma-token');
  });

  it('builds correct URL for getFile', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        name: 'Test',
        lastModified: '2026-01-01T00:00:00Z',
        version: '1',
        document: {},
      }),
    );

    const client = createFigmaClient('key');
    await client.getFile('fileKey123');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/files/fileKey123');
  });

  it('builds correct URL for getFileNodes with node IDs', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        name: 'Test',
        lastModified: '2026-01-01T00:00:00Z',
        version: '1',
        nodes: {},
      }),
    );

    const client = createFigmaClient('key');
    await client.getFileNodes('fileKey', ['1:2', '3:4']);

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/files/fileKey/nodes');
    expect(url).toContain('ids=1%3A2%2C3%3A4');
  });

  it('builds correct URL for getImages', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({ images: { '1:2': 'https://example.com/img.png' } }),
    );

    const client = createFigmaClient('key');
    await client.getImages('fileKey', ['1:2'], { format: 'png', scale: 2 });

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/images/fileKey');
    expect(url).toContain('format=png');
    expect(url).toContain('scale=2');
  });

  it('builds correct URL for getComments', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ comments: [] }));

    const client = createFigmaClient('key');
    await client.getComments('fileKey');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/files/fileKey/comments');
  });

  it('posts comment with correct body', async () => {
    mockFetch.mockResolvedValue(
      makeJsonResponse({
        id: 'comment1',
        message: 'Hello',
        created_at: '2026-01-01T00:00:00Z',
        user: { id: 'u1', handle: 'user1' },
      }),
    );

    const client = createFigmaClient('key');
    await client.postComment('fileKey', 'Hello', '1:2');

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/files/fileKey/comments');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.message).toBe('Hello');
    expect(body.client_meta).toEqual({ node_id: '1:2' });
  });

  it('builds correct URL for getProjectFiles', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ name: 'Project', files: [] }));

    const client = createFigmaClient('key');
    await client.getProjectFiles('proj123');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/projects/proj123/files');
  });

  it('builds correct URL for getFileStyles', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ meta: { styles: [] } }));

    const client = createFigmaClient('key');
    await client.getFileStyles('fileKey');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/files/fileKey/styles');
  });

  it('builds correct URL for getFileComponents', async () => {
    mockFetch.mockResolvedValue(makeJsonResponse({ meta: { components: [] } }));

    const client = createFigmaClient('key');
    await client.getFileComponents('fileKey');

    const url = mockFetch.mock.calls[0]?.[0] as string;
    expect(url).toContain('/files/fileKey/components');
  });
});
