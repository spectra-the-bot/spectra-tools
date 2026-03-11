import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFigmaClient } from '../../api.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('files commands — API integration', () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  describe('files get', () => {
    it('calls getFile with the correct file key and extracts pages', async () => {
      const mockResponse = {
        name: 'Design System',
        lastModified: '2026-03-10T12:00:00Z',
        version: '456',
        document: {
          children: [
            { id: '0:1', name: 'Page 1', type: 'CANVAS' },
            { id: '0:2', name: 'Page 2', type: 'CANVAS' },
          ],
        },
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getFile('fileKey123', { depth: 1 });

      expect(result.name).toBe('Design System');
      expect(result.lastModified).toBe('2026-03-10T12:00:00Z');
      expect(result.version).toBe('456');

      // Verify the document children are present (pages)
      const doc = result.document as { children?: Array<{ id: string; name: string }> };
      expect(doc.children).toHaveLength(2);
      expect(doc.children?.[0]).toEqual(expect.objectContaining({ id: '0:1', name: 'Page 1' }));

      // Verify correct URL was called
      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain('/files/fileKey123');
      expect(url).toContain('depth=1');
    });

    it('handles file with no pages gracefully', async () => {
      const mockResponse = {
        name: 'Empty File',
        lastModified: '2026-03-10T12:00:00Z',
        version: '1',
        document: {},
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getFile('emptyFile');

      expect(result.name).toBe('Empty File');
      const doc = result.document as { children?: unknown[] };
      expect(doc.children).toBeUndefined();
    });

    it('passes query params for depth option', async () => {
      const mockResponse = {
        name: 'Test',
        lastModified: '2026-03-10T12:00:00Z',
        version: '1',
        document: {},
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      await client.getFile('fileKey', { depth: 2 });

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain('depth=2');
    });
  });

  describe('files list', () => {
    it('calls getProjectFiles with the correct project ID', async () => {
      const mockResponse = {
        name: 'My Project',
        files: [
          {
            key: 'abc123',
            name: 'Homepage',
            thumbnail_url: 'https://figma.com/thumb/abc123',
            last_modified: '2026-03-09T10:00:00Z',
          },
          {
            key: 'def456',
            name: 'Components',
            thumbnail_url: 'https://figma.com/thumb/def456',
            last_modified: '2026-03-08T08:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getProjectFiles('proj789');

      expect(result.name).toBe('My Project');
      expect(result.files).toHaveLength(2);
      expect(result.files[0]).toEqual(
        expect.objectContaining({
          key: 'abc123',
          name: 'Homepage',
          last_modified: '2026-03-09T10:00:00Z',
        }),
      );

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain('/projects/proj789/files');
    });

    it('handles empty project file list', async () => {
      const mockResponse = {
        name: 'Empty Project',
        files: [],
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getProjectFiles('emptyProj');

      expect(result.files).toHaveLength(0);
    });

    it('returns file metadata with thumbnail URLs', async () => {
      const mockResponse = {
        name: 'Design Project',
        files: [
          {
            key: 'key1',
            name: 'File with thumb',
            thumbnail_url: 'https://figma.com/thumb/key1',
            last_modified: '2026-03-09T10:00:00Z',
          },
        ],
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getProjectFiles('proj456');

      expect(result.files[0].thumbnail_url).toBe('https://figma.com/thumb/key1');
    });
  });
});
