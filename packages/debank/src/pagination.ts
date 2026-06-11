import { z } from 'incur';

/** Shared pagination options for list-returning commands. */
export const paginationOptions = z.object({
  page: z.number().int().min(1).optional().default(1).describe('Page number, starting from 1'),
  pageSize: z.number().int().min(1).optional().default(5).describe('Number of records per page'),
});

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationInfo;
}

/**
 * Client-side pagination over a fully-materialized array, mirroring the DeBank
 * MCP server's behavior. DeBank list endpoints return the full array; we slice
 * it so agent output stays bounded. Non-array inputs are returned untouched.
 */
export function paginate<T>(results: T[], page = 1, pageSize = 5): PaginatedResult<T> {
  const totalItems = results.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;
  const data = results.slice(start, start + pageSize);
  return {
    data,
    pagination: { page, pageSize, totalItems, totalPages },
  };
}
