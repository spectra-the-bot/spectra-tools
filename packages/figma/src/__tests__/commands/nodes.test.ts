import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFigmaClient } from '../../api.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('nodes commands — API integration', () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  describe('nodes get', () => {
    it('passes both file key and node ID correctly', async () => {
      const mockResponse = {
        name: 'Test File',
        lastModified: '2026-03-10T12:00:00Z',
        version: '1',
        nodes: {
          '1:2': {
            document: {
              id: '1:2',
              name: 'Header Frame',
              type: 'FRAME',
              absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 900 },
              children: [
                { id: '1:3', name: 'Logo', type: 'INSTANCE' },
                { id: '1:4', name: 'Nav', type: 'GROUP' },
              ],
            },
          },
        },
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getFileNodes('fileABC', ['1:2']);

      // Verify URL contains both file key and node IDs
      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain('/files/fileABC/nodes');
      expect(url).toContain('ids=1%3A2');

      // Verify node data is returned
      const nodeData = result.nodes['1:2'] as {
        document: { id: string; name: string; type: string; children: unknown[] };
      };
      expect(nodeData.document.name).toBe('Header Frame');
      expect(nodeData.document.type).toBe('FRAME');
      expect(nodeData.document.children).toHaveLength(2);
    });

    it('handles node with bounding box data', async () => {
      const mockResponse = {
        name: 'Test File',
        lastModified: '2026-03-10T12:00:00Z',
        version: '1',
        nodes: {
          '5:10': {
            document: {
              id: '5:10',
              name: 'Button',
              type: 'COMPONENT',
              absoluteBoundingBox: { x: 100, y: 200, width: 120, height: 48 },
              children: [],
            },
          },
        },
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getFileNodes('fileXYZ', ['5:10']);

      const nodeData = result.nodes['5:10'] as {
        document: {
          absoluteBoundingBox: { x: number; y: number; width: number; height: number };
        };
      };
      expect(nodeData.document.absoluteBoundingBox).toEqual({
        x: 100,
        y: 200,
        width: 120,
        height: 48,
      });
    });

    it('handles node not found (missing node in response)', async () => {
      const mockResponse = {
        name: 'Test File',
        lastModified: '2026-03-10T12:00:00Z',
        version: '1',
        nodes: {
          '99:99': null,
        },
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getFileNodes('fileKey', ['99:99']);

      // The API returns null for nodes that don't exist
      expect(result.nodes['99:99']).toBeNull();
    });

    it('passes multiple node IDs correctly', async () => {
      const mockResponse = {
        name: 'Test File',
        lastModified: '2026-03-10T12:00:00Z',
        version: '1',
        nodes: {
          '1:2': {
            document: { id: '1:2', name: 'Node A', type: 'FRAME', children: [] },
          },
          '3:4': {
            document: { id: '3:4', name: 'Node B', type: 'GROUP', children: [] },
          },
        },
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      await client.getFileNodes('fileKey', ['1:2', '3:4']);

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain('ids=1%3A2%2C3%3A4');
    });

    it('returns version and file name alongside node data', async () => {
      const mockResponse = {
        name: 'My Design File',
        lastModified: '2026-03-10T12:00:00Z',
        version: '42',
        nodes: {
          '2:5': {
            document: { id: '2:5', name: 'Card', type: 'COMPONENT', children: [] },
          },
        },
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getFileNodes('fileKey', ['2:5']);

      expect(result.name).toBe('My Design File');
      expect(result.version).toBe('42');
    });

    it('handles node with deeply nested children', async () => {
      const mockResponse = {
        name: 'Test File',
        lastModified: '2026-03-10T12:00:00Z',
        version: '1',
        nodes: {
          '1:1': {
            document: {
              id: '1:1',
              name: 'Root',
              type: 'FRAME',
              children: [
                {
                  id: '1:2',
                  name: 'Level 1',
                  type: 'GROUP',
                  children: [
                    {
                      id: '1:3',
                      name: 'Level 2',
                      type: 'RECTANGLE',
                      children: [],
                    },
                  ],
                },
              ],
            },
          },
        },
      };

      mockFetch.mockResolvedValue(makeJsonResponse(mockResponse));

      const client = createFigmaClient('test-key');
      const result = await client.getFileNodes('fileKey', ['1:1']);

      const nodeData = result.nodes['1:1'] as {
        document: { children: Array<{ children: unknown[] }> };
      };
      expect(nodeData.document.children).toHaveLength(1);
      expect(nodeData.document.children[0].children).toHaveLength(1);
    });
  });
});
