import { Cli, z } from 'incur';
import { createDefiLlamaClient } from '../api.js';
import { formatPct, formatUsd } from '../format.js';
import { protocolSummarySchema } from '../types.js';
import { withCta } from './cta.js';

export const protocolsCli = Cli.create('protocols', {
  description: 'Protocol queries (ranked by TVL).',
});

/* ── protocols list ─────────────────────────────────────────── */

const protocolSortFields = ['tvl', 'change_1d', 'change_7d'] as const;

protocolsCli.command('list', {
  description: 'List protocols ranked by TVL (alias for tvl protocols).',
  options: z.object({
    chain: z.string().optional().describe('Filter protocols by chain name'),
    limit: z.coerce.number().default(20).describe('Max protocols to display'),
    sort: z
      .enum(protocolSortFields)
      .default('tvl')
      .describe('Sort field: tvl, change_1d, or change_7d'),
  }),
  output: z.object({
    protocols: z.array(
      z.object({
        name: z.string(),
        tvl: z.string(),
        change_1d: z.string(),
        change_7d: z.string(),
        category: z.string(),
      }),
    ),
    chain: z.string().optional(),
    total: z.number(),
  }),
  examples: [
    { options: { limit: 10 }, description: 'Top 10 protocols by TVL' },
    { options: { chain: 'abstract', limit: 10 }, description: 'Top protocols on Abstract' },
    { options: { sort: 'change_1d', limit: 5 }, description: 'Top 5 by 1-day change' },
  ],
  async run(c) {
    const client = createDefiLlamaClient();
    const raw = await client.get<unknown[]>('api', '/protocols');
    const protocols = raw.map((p) => protocolSummarySchema.parse(p));

    let filtered = protocols;

    if (c.options.chain) {
      const chainLower = c.options.chain.toLowerCase();
      filtered = filtered.filter(
        (p) => p.chains?.some((ch) => ch.toLowerCase() === chainLower) ?? false,
      );
    }

    // Filter out null/zero TVL
    filtered = filtered.filter((p) => p.tvl != null && p.tvl > 0);

    // Sort
    const sortKey = c.options.sort;
    filtered.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return (bVal as number) - (aVal as number);
    });

    const limited = filtered.slice(0, c.options.limit);

    const rows = limited.map((p) => ({
      name: p.name,
      tvl: formatUsd(p.tvl ?? 0),
      change_1d: formatPct(p.change_1d),
      change_7d: formatPct(p.change_7d),
      category: p.category ?? '—',
    }));

    const topSlug = limited[0]?.slug;

    return c.ok(
      {
        protocols: rows,
        chain: c.options.chain,
        total: filtered.length,
      },
      withCta(c.format, 'Next steps:', [
        {
          command: 'tvl protocol',
          args: { slug: topSlug ?? true },
          description: 'Inspect the top protocol in detail',
        },
      ]),
    );
  },
});
