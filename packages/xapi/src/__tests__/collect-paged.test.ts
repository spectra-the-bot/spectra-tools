import { describe, expect, it } from 'vitest';
import { collectPaged } from '../collect-paged.js';

describe('collectPaged', () => {
  it('returns an empty list for empty responses', async () => {
    const calls: Array<{ limit: number; cursor?: string }> = [];

    const results = await collectPaged(
      async (limit, cursor) => {
        calls.push({ limit, cursor });
        return {};
      },
      (item: string) => item,
      10,
    );

    expect(results).toEqual([]);
    expect(calls).toEqual([{ limit: 10, cursor: undefined }]);
  });

  it('collects a single page when no next token is present', async () => {
    const calls: Array<{ limit: number; cursor?: string }> = [];

    const results = await collectPaged(
      async (limit, cursor) => {
        calls.push({ limit, cursor });
        return {
          data: [{ id: '1' }, { id: '2' }],
          meta: {},
        };
      },
      (item) => item.id,
      5,
    );

    expect(results).toEqual(['1', '2']);
    expect(calls).toEqual([{ limit: 5, cursor: undefined }]);
  });

  it('collects across multiple pages and respects maxResults', async () => {
    const calls: Array<{ limit: number; cursor?: string }> = [];

    const results = await collectPaged(
      async (limit, cursor) => {
        calls.push({ limit, cursor });

        if (!cursor) {
          return {
            data: [{ id: '1' }, { id: '2' }],
            meta: { next_token: 'p2' },
          };
        }

        if (cursor === 'p2') {
          return {
            data: [{ id: '3' }, { id: '4' }],
            meta: { next_token: 'p3' },
          };
        }

        return {
          data: [{ id: '5' }],
          meta: {},
        };
      },
      (item) => Number(item.id),
      4,
      2,
    );

    expect(results).toEqual([1, 2, 3, 4]);
    expect(calls).toEqual([
      { limit: 2, cursor: undefined },
      { limit: 2, cursor: 'p2' },
    ]);
  });
});
