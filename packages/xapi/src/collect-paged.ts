import { paginateCursor } from '@spectra-the-bot/cli-shared';

interface XPagedResponse<T> {
  data?: T[];
  meta?: { next_token?: string };
}

export async function collectPaged<T, R>(
  fetchFn: (limit: number, cursor?: string) => Promise<XPagedResponse<T>>,
  mapFn: (item: T) => R,
  maxResults: number,
  pageSize = 100,
): Promise<R[]> {
  const results: R[] = [];

  for await (const item of paginateCursor({
    fetchPage: async (cursor: string | null) => {
      const res = await fetchFn(Math.min(maxResults - results.length, pageSize), cursor ?? undefined);
      return {
        items: res.data ?? [],
        nextCursor: res.meta?.next_token ?? null,
      };
    },
  })) {
    results.push(mapFn(item));
    if (results.length >= maxResults) break;
  }

  return results;
}
