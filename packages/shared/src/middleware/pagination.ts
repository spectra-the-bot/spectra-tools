export interface CursorPaginationOptions<T> {
  fetchPage: (cursor: string | null) => Promise<{ items: T[]; nextCursor: string | null }>;
}

export interface OffsetPaginationOptions<T> {
  fetchPage: (offset: number, limit: number) => Promise<{ items: T[]; total: number }>;
  limit?: number;
}

/**
 * Async iterator for cursor-based pagination.
 */
export async function* paginateCursor<T>(options: CursorPaginationOptions<T>): AsyncGenerator<T> {
  let cursor: string | null = null;

  while (true) {
    const { items, nextCursor } = await options.fetchPage(cursor);
    for (const item of items) {
      yield item;
    }
    if (!nextCursor) break;
    cursor = nextCursor;
  }
}

/**
 * Async iterator for offset-based pagination.
 */
export async function* paginateOffset<T>(options: OffsetPaginationOptions<T>): AsyncGenerator<T> {
  const limit = options.limit ?? 100;
  let offset = 0;

  while (true) {
    const { items, total } = await options.fetchPage(offset, limit);
    for (const item of items) {
      yield item;
    }
    offset += items.length;
    if (offset >= total || items.length === 0) break;
  }
}
