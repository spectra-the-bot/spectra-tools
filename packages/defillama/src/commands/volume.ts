import { Cli, z } from 'incur';
import { createDefiLlamaClient } from '../api.js';
import { formatPct, formatUsd } from '../format.js';
import { summaryDetailSchema, volumeOverviewResponseSchema } from '../types.js';
import { withCta } from './cta.js';

export const volumeCli = Cli.create('volume', {
  description: 'DEX volume queries.',
});

/* ── Shared dexs/overview schemas & handler ─────────────────── */

const dexsSortFields = ['total24h', 'total7d', 'change_1d'] as const;

const dexsOverviewOptions = z.object({
  chain: z.string().optional().describe('Filter by chain name'),
  limit: z.coerce.number().default(20).describe('Max protocols to display'),
  sort: z
    .enum(dexsSortFields)
    .default('total24h')
    .describe('Sort field: total24h, total7d, or change_1d'),
  category: z.string().optional().describe('Filter by category (e.g. Dexs, Prediction)'),
});

const dexsOverviewOutput = z.object({
  protocols: z.array(
    z.object({
      name: z.string(),
      volume_24h: z.string(),
      volume_7d: z.string(),
      change_1d: z.string(),
    }),
  ),
  chain: z.string().optional(),
  category: z.string().optional(),
  total: z.number(),
});

async function runDexsOverview(options: z.infer<typeof dexsOverviewOptions>) {
  const client = createDefiLlamaClient();
  const path = options.chain
    ? `/overview/dexs/${options.chain}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`
    : '/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true';
  const raw = await client.get<unknown>('api', path);
  const data = volumeOverviewResponseSchema.parse(raw);

  let protocols = data.protocols;

  // Category filter
  if (options.category) {
    const catLower = options.category.toLowerCase();
    protocols = protocols.filter(
      (p) => p.category != null && p.category.toLowerCase() === catLower,
    );
  }

  // Filter out null/zero volume
  protocols = protocols.filter((p) => p.total24h != null && p.total24h > 0);

  // Sort
  const sortKey = options.sort;
  protocols.sort((a, b) => {
    const aVal = a[sortKey] ?? 0;
    const bVal = b[sortKey] ?? 0;
    return (bVal as number) - (aVal as number);
  });

  const limited = protocols.slice(0, options.limit);

  const rows = limited.map((p) => ({
    name: p.displayName ?? p.name,
    volume_24h: formatUsd(p.total24h ?? 0),
    volume_7d: formatUsd(p.total7d ?? 0),
    change_1d: formatPct(p.change_1d),
  }));

  return {
    protocols: rows,
    chain: options.chain,
    category: options.category,
    total: protocols.length,
    topSlug: limited[0]?.slug,
  };
}

/* ── volume dexs ────────────────────────────────────────────── */

volumeCli.command('dexs', {
  description: 'List DEXes ranked by trading volume.',
  options: dexsOverviewOptions,
  output: dexsOverviewOutput,
  examples: [
    { options: { limit: 10 }, description: 'Top 10 DEXes by 24h volume' },
    { options: { chain: 'abstract', limit: 10 }, description: 'Top DEXes on Abstract' },
    { options: { sort: 'change_1d', limit: 5 }, description: 'Top 5 by 1-day volume change' },
    {
      options: { category: 'Dexs', limit: 10 },
      description: 'Top 10 DEXes excluding prediction markets',
    },
  ],
  async run(c) {
    const { topSlug, ...result } = await runDexsOverview(c.options);

    return c.ok(
      result,
      withCta(c.format, 'Next steps:', [
        {
          command: 'volume protocol',
          args: { slug: topSlug ?? true },
          description: 'Drill into detailed metrics for a high-volume protocol',
        },
      ]),
    );
  },
});

/* ── volume overview (alias for dexs) ───────────────────────── */

volumeCli.command('overview', {
  description: 'Overview of DEX trading volume (alias for volume dexs).',
  options: dexsOverviewOptions,
  output: dexsOverviewOutput,
  examples: [
    { options: { limit: 10 }, description: 'Top 10 DEXes by 24h volume' },
    { options: { chain: 'abstract', limit: 5 }, description: 'Top 5 DEXes on Abstract by volume' },
  ],
  async run(c) {
    const { topSlug, ...result } = await runDexsOverview(c.options);

    return c.ok(
      result,
      withCta(c.format, 'Next steps:', [
        {
          command: 'volume protocol',
          args: { slug: topSlug ?? true },
          description: 'Open protocol-specific volume metrics from the overview',
        },
        {
          command: 'fees overview',
          options: { chain: c.options.chain ?? true },
          description: 'Compare trading volume with fee rankings',
        },
      ]),
    );
  },
});

/* ── volume protocol <slug> ─────────────────────────────────── */

volumeCli.command('protocol', {
  description: 'Get detailed volume data for a specific protocol.',
  args: z.object({
    slug: z.string().describe('Protocol slug (e.g. uniswap, curve-dex)'),
  }),
  output: z.object({
    name: z.string(),
    volume_24h: z.string(),
    volume_7d: z.string(),
    volume_30d: z.string(),
    volume_all_time: z.string(),
    change_1d: z.string(),
    change_7d: z.string(),
    change_1m: z.string(),
    chains: z.array(z.string()),
  }),
  examples: [{ args: { slug: 'uniswap' }, description: 'Uniswap volume details' }],
  async run(c) {
    const client = createDefiLlamaClient();
    const raw = await client.get<unknown>('api', `/summary/dexs/${c.args.slug}`);
    const detail = summaryDetailSchema.parse(raw);

    return c.ok(
      {
        name: detail.displayName ?? detail.name,
        volume_24h: formatUsd(detail.total24h ?? 0),
        volume_7d: formatUsd(detail.total7d ?? 0),
        volume_30d: formatUsd(detail.total30d ?? 0),
        volume_all_time: formatUsd(detail.totalAllTime ?? 0),
        change_1d: formatPct(detail.change_1d),
        change_7d: formatPct(detail.change_7d),
        change_1m: formatPct(detail.change_1m),
        chains: detail.chains ?? [],
      },
      withCta(c.format, 'Next steps:', [
        {
          command: 'fees protocol',
          args: { slug: c.args.slug },
          description: "Compare this protocol's volume with its fee profile",
        },
      ]),
    );
  },
});

/* ── volume aggregators ─────────────────────────────────────── */

volumeCli.command('aggregators', {
  description: 'List DEX aggregators ranked by trading volume.',
  options: z.object({
    chain: z.string().optional().describe('Filter by chain name'),
    limit: z.coerce.number().default(20).describe('Max aggregators to display'),
  }),
  output: z.object({
    protocols: z.array(
      z.object({
        name: z.string(),
        volume_24h: z.string(),
        volume_7d: z.string(),
        change_1d: z.string(),
      }),
    ),
    chain: z.string().optional(),
    total: z.number(),
  }),
  examples: [
    { options: { limit: 10 }, description: 'Top 10 DEX aggregators by volume' },
    {
      options: { chain: 'ethereum', limit: 5 },
      description: 'Top 5 aggregators on Ethereum',
    },
  ],
  async run(c) {
    const client = createDefiLlamaClient();
    const path = c.options.chain
      ? `/overview/aggregators/${c.options.chain}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`
      : '/overview/aggregators?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true';
    const raw = await client.get<unknown>('api', path);
    const data = volumeOverviewResponseSchema.parse(raw);

    let protocols = data.protocols;

    // Filter out null/zero volume
    protocols = protocols.filter((p) => p.total24h != null && p.total24h > 0);

    // Sort by 24h volume descending
    protocols.sort((a, b) => (b.total24h ?? 0) - (a.total24h ?? 0));

    const limited = protocols.slice(0, c.options.limit);

    const rows = limited.map((p) => ({
      name: p.displayName ?? p.name,
      volume_24h: formatUsd(p.total24h ?? 0),
      volume_7d: formatUsd(p.total7d ?? 0),
      change_1d: formatPct(p.change_1d),
    }));
    const topChain = limited[0]?.chains?.[0]?.toLowerCase();

    return c.ok(
      {
        protocols: rows,
        chain: c.options.chain,
        total: protocols.length,
      },
      withCta(c.format, 'Next steps:', [
        {
          command: 'volume overview',
          options: { chain: c.options.chain ?? topChain ?? true },
          description: 'Compare aggregator flow against direct DEX volume on a chain',
        },
      ]),
    );
  },
});
