import { z } from 'incur';

export { figmaEnv } from '../auth.js';

/** Positional argument for a Figma file key (string, required). */
export const fileKeyArg = z.string().describe('Figma file key (from the file URL)');

/** --format option: json or table (default: json). */
export const formatOption = z
  .enum(['json', 'table'])
  .default('json')
  .describe('Output format: json or table');

/** Format data as JSON or a simple aligned table. */
export function outputFormatter(
  data: Record<string, unknown>[] | Record<string, unknown>,
  format: 'json' | 'table',
): string {
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }

  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) return '(no data)';

  const keys = Object.keys(rows[0]);
  const widths = keys.map((k) => Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length)));

  const header = keys.map((k, i) => k.padEnd(widths[i])).join('  ');
  const separator = widths.map((w) => '-'.repeat(w)).join('  ');
  const body = rows
    .map((r) => keys.map((k, i) => String(r[k] ?? '').padEnd(widths[i])).join('  '))
    .join('\n');

  return `${header}\n${separator}\n${body}`;
}
