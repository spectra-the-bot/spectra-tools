import { Cli, z } from 'incur';
import { createDefiLlamaClient } from '../api.js';
import { formatPct, formatUsd } from '../format.js';
import { feeOverviewResponseSchema, summaryDetailSchema } from '../types.js';

export const feesCli = Cli.create('fees', {
  description: 'Protocol fees and revenue queries.',
});

/* ── fees overview ──────────────────────────────────────────── */

const feesSortFields = ['total24h', 'total7d', 'change_1d'] as const;

feesCli.command('overview', {
  description: 'List protocols ranked by fees and revenue.',
  options: z.object({
    chain: z.string().optional().describe('Filter by chain name'),
    limit: z.coerce.number().default(20).describe('Max protocols to display'),
    sort: z
      .enum(feesSortFields)
      .default('total24h')
      .describe('Sort field: total24h, total7d, or change_1d'),
    category: z.string().optional().describe('Filter by category (e.g. Dexs, Lending, Bridge)'),
  }),
  output: z.object({
    protocols: z.array(
      z.object({
        name: z.string(),
        fees_24h: z.string(),
        fees_7d: z.string(),
        change_1d: z.string(),
      }),
    ),
    chain: z.string().optional(),
    category: z.string().optional(),
    total: z.number(),
  }),
  examples: [
    { options: { limit: 10 }, description: 'Top 10 protocols by 24h fees' },
    { options: { chain: 'abstract', limit: 10 }, description: 'Top protocols on Abstract by fees' },
    { options: { sort: 'change_1d', limit: 5 }, description: 'Top 5 by 1-day fee change' },
    {
      options: { category: 'Dexs', limit: 10 },
      description: 'Top 10 DEXes by fees',
    },
  ],
  async run(c) {
    const client = createDefiLlamaClient();
    const path = c.options.chain
      ? `/overview/fees/${c.options.chain}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`
      : '/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true';
    const raw = await client.get<unknown>('api', path);
    const data = feeOverviewResponseSchema.parse(raw);

    let protocols = data.protocols;

    // Category filter
    if (c.options.category) {
      const catLower = c.options.category.toLowerCase();
      protocols = protocols.filter(
        (p) => p.category != null && p.category.toLowerCase() === catLower,
      );
    }

    // Filter out null/zero fees
    protocols = protocols.filter((p) => p.total24h != null && p.total24h > 0);

    // Sort
    const sortKey = c.options.sort;
    protocols.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return (bVal as number) - (aVal as number);
    });

    const limited = protocols.slice(0, c.options.limit);

    const rows = limited.map((p) => ({
      name: p.displayName ?? p.name,
      fees_24h: formatUsd(p.total24h ?? 0),
      fees_7d: formatUsd(p.total7d ?? 0),
      change_1d: formatPct(p.change_1d),
    }));

    return c.ok({
      protocols: rows,
      chain: c.options.chain,
      category: c.options.category,
      total: protocols.length,
    });
  },
});

/* ── fees protocol <slug> ───────────────────────────────────── */

feesCli.command('protocol', {
  description: 'Get detailed fee and revenue data for a specific protocol.',
  args: z.object({
    slug: z.string().describe('Protocol slug (e.g. aave, lido)'),
  }),
  output: z.object({
    name: z.string(),
    fees_24h: z.string(),
    fees_7d: z.string(),
    fees_30d: z.string(),
    fees_all_time: z.string(),
    change_1d: z.string(),
    change_7d: z.string(),
    change_1m: z.string(),
    chains: z.array(z.string()),
  }),
  examples: [{ args: { slug: 'aave' }, description: 'Aave fee details' }],
  async run(c) {
    const client = createDefiLlamaClient();
    const raw = await client.get<unknown>('api', `/summary/fees/${c.args.slug}`);
    const detail = summaryDetailSchema.parse(raw);

    return c.ok({
      name: detail.displayName ?? detail.name,
      fees_24h: formatUsd(detail.total24h ?? 0),
      fees_7d: formatUsd(detail.total7d ?? 0),
      fees_30d: formatUsd(detail.total30d ?? 0),
      fees_all_time: formatUsd(detail.totalAllTime ?? 0),
      change_1d: formatPct(detail.change_1d),
      change_7d: formatPct(detail.change_7d),
      change_1m: formatPct(detail.change_1m),
      chains: detail.chains ?? [],
    });
  },
});
