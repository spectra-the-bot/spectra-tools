import { describe, expect, it } from 'vitest';
import { collectPaged } from '../collect-paged.js';

describe('collectPaged', () => {
  it('collects pages, maps items, and respects maxResults', async () => {
    const calls: Array<{ limit: number; cursor?: string }> = [];

    const results = await collectPaged(
      async (limit, cursor) => {
        calls.push({ limit, cursor });

        if (!cursor) {
          return {
            data: [{ id: '1' }, { id: '2' }],
            meta: { next_token: 'next-1' },
          };
        }

        if (cursor === 'next-1') {
          return {
            data: [{ id: '3' }, { id: '4' }],
            meta: { next_token: 'next-2' },
          };
        }

        return { data: [{ id: '5' }], meta: {} };
      },
      (item) => Number(item.id),
      3,
      2,
    );

    expect(results).toEqual([1, 2, 3]);
    expect(calls).toEqual([
      { limit: 2, cursor: undefined },
      { limit: 1, cursor: 'next-1' },
    ]);
  });

  it('handles empty pages when data/meta are missing', async () => {
    const calls: Array<{ limit: number; cursor?: string }> = [];

    const results = await collectPaged(
      async (limit, cursor) => {
        calls.push({ limit, cursor });
        return {};
      },
      (item: string) => item.toUpperCase(),
      10,
    );

    expect(results).toEqual([]);
    expect(calls).toEqual([{ limit: 10, cursor: undefined }]);
  });
});
