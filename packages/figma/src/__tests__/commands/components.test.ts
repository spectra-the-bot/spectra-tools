import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFigmaClient } from '../../api.js';

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('components commands (API layer)', () => {
  const mockFetch = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockReset();
  });

  describe('components list', () => {
    it('fetches published components for a file', async () => {
      mockFetch.mockResolvedValue(
        makeJsonResponse({
          meta: {
            components: [
              { key: 'comp:1', name: 'Button', description: 'Primary button' },
              { key: 'comp:2', name: 'Card', description: 'Content card' },
            ],
          },
        }),
      );

      const client = createFigmaClient('test-key');
      const result = await client.getFileComponents('fileKey123');

      expect(result.meta.components).toHaveLength(2);
      expect(result.meta.components[0]?.name).toBe('Button');
      expect(result.meta.components[1]?.name).toBe('Card');

      const url = mockFetch.mock.calls[0]?.[0] as string;
      expect(url).toContain('/files/fileKey123/components');
    });

    it('returns empty array when no components exist', async () => {
      mockFetch.mockResolvedValue(
        makeJsonResponse({
          meta: { components: [] },
        }),
      );

      const client = createFigmaClient('test-key');
      const result = await client.getFileComponents('fileKey123');

      expect(result.meta.components).toHaveLength(0);
    });
  });

  describe('components get', () => {
    it('finds a specific component by key', async () => {
      mockFetch.mockResolvedValue(
        makeJsonResponse({
          meta: {
            components: [
              { key: 'comp:1', name: 'Button', description: 'Primary button' },
              { key: 'comp:2', name: 'Card', description: 'Content card' },
            ],
          },
        }),
      );

      const client = createFigmaClient('test-key');
      const result = await client.getFileComponents('fileKey123');
      const match = result.meta.components.find((c) => c.key === 'comp:2');

      expect(match).toBeDefined();
      expect(match?.name).toBe('Card');
      expect(match?.description).toBe('Content card');
    });

    it('returns undefined when component key not found', async () => {
      mockFetch.mockResolvedValue(
        makeJsonResponse({
          meta: {
            components: [{ key: 'comp:1', name: 'Button', description: 'Primary button' }],
          },
        }),
      );

      const client = createFigmaClient('test-key');
      const result = await client.getFileComponents('fileKey123');
      const match = result.meta.components.find((c) => c.key === 'comp:999');

      expect(match).toBeUndefined();
    });
  });

  describe('component data shape', () => {
    it('includes key, name, and description fields', async () => {
      mockFetch.mockResolvedValue(
        makeJsonResponse({
          meta: {
            components: [
              { key: 'comp:abc', name: 'Icon/Arrow', description: 'Directional arrow icon' },
            ],
          },
        }),
      );

      const client = createFigmaClient('test-key');
      const result = await client.getFileComponents('fileKey');
      const component = result.meta.components[0];

      expect(component).toEqual({
        key: 'comp:abc',
        name: 'Icon/Arrow',
        description: 'Directional arrow icon',
      });
    });
  });
});
