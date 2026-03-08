import { describe, expect, it, vi } from 'vitest';
import { paginateCursor, paginateOffset } from '../middleware/pagination.js';

describe('paginateCursor', () => {
  it('returns no items for an empty first page', async () => {
    const fetchPage = vi.fn(async () => ({ items: [] as number[], nextCursor: null }));

    const items: number[] = [];
    for await (const item of paginateCursor({ fetchPage })) {
      items.push(item);
    }

    expect(items).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(null);
  });

  it('iterates a single page when nextCursor is null', async () => {
    const fetchPage = vi.fn(async () => ({ items: [1, 2, 3], nextCursor: null }));

    const items: number[] = [];
    for await (const item of paginateCursor({ fetchPage })) {
      items.push(item);
    }

    expect(items).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(null);
  });

  it('iterates multiple pages using cursors', async () => {
    const pages = new Map<string | null, { items: string[]; nextCursor: string | null }>([
      [null, { items: ['a', 'b'], nextCursor: 'c1' }],
      ['c1', { items: ['c'], nextCursor: 'c2' }],
      ['c2', { items: ['d', 'e'], nextCursor: null }],
    ]);

    const fetchPage = vi.fn(async (cursor: string | null) => {
      const page = pages.get(cursor);
      if (!page) throw new Error(`Unexpected cursor: ${cursor}`);
      return page;
    });

    const items: string[] = [];
    for await (const item of paginateCursor({ fetchPage })) {
      items.push(item);
    }

    expect(items).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.map((call) => call[0])).toEqual([null, 'c1', 'c2']);
  });
});

describe('paginateOffset', () => {
  it('returns no items for an empty first page', async () => {
    const fetchPage = vi.fn(async () => ({ items: [] as number[], total: 0 }));

    const items: number[] = [];
    for await (const item of paginateOffset({ fetchPage })) {
      items.push(item);
    }

    expect(items).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, 100);
  });

  it('iterates a single page when offset reaches total', async () => {
    const fetchPage = vi.fn(async () => ({ items: [1, 2], total: 2 }));

    const items: number[] = [];
    for await (const item of paginateOffset({ fetchPage, limit: 2 })) {
      items.push(item);
    }

    expect(items).toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, 2);
  });

  it('iterates multiple pages using offset + limit', async () => {
    const fetchPage = vi
      .fn<(offset: number, limit: number) => Promise<{ items: number[]; total: number }>>()
      .mockImplementation(async (offset: number) => {
        if (offset === 0) return { items: [1, 2], total: 5 };
        if (offset === 2) return { items: [3, 4], total: 5 };
        if (offset === 4) return { items: [5], total: 5 };
        throw new Error(`Unexpected offset: ${offset}`);
      });

    const items: number[] = [];
    for await (const item of paginateOffset({ fetchPage, limit: 2 })) {
      items.push(item);
    }

    expect(items).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage.mock.calls.map((call) => [call[0], call[1]])).toEqual([
      [0, 2],
      [2, 2],
      [4, 2],
    ]);
  });

  it('stops after one page when total is less than limit', async () => {
    const fetchPage = vi.fn(async () => ({ items: ['x', 'y', 'z'], total: 3 }));

    const items: string[] = [];
    for await (const item of paginateOffset({ fetchPage, limit: 10 })) {
      items.push(item);
    }

    expect(items).toEqual(['x', 'y', 'z']);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(0, 10);
  });
});
