import { Cli, z } from 'incur';
import { createDefiLlamaClient } from '../api.js';
import { formatPct, formatUsd } from '../format.js';
import { chainTvlSchema, protocolDetailSchema, protocolSummarySchema } from '../types.js';
import { withCta } from './cta.js';

export const tvlCli = Cli.create('tvl', {
  description: 'Total value locked queries.',
});

/* ── tvl protocols ──────────────────────────────────────────── */

const protocolSortFields = ['tvl', 'change_1d', 'change_7d'] as const;

tvlCli.command('protocols', {
  description: 'List protocols ranked by TVL.',
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
      // For change fields, sort descending by absolute value is less useful;
      // sort descending by value so highest positive changes appear first
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
          description: 'Open protocol-level TVL details for a ranked result',
        },
      ]),
    );
  },
});

/* ── tvl chains ─────────────────────────────────────────────── */

tvlCli.command('chains', {
  description: 'List chains ranked by TVL.',
  options: z.object({
    limit: z.coerce.number().default(20).describe('Max chains to display'),
  }),
  output: z.object({
    chains: z.array(
      z.object({
        name: z.string(),
        tvl: z.string(),
      }),
    ),
    total: z.number(),
  }),
  examples: [{ options: { limit: 10 }, description: 'Top 10 chains by TVL' }],
  async run(c) {
    const client = createDefiLlamaClient();
    const raw = await client.get<unknown[]>('api', '/v2/chains');
    const chains = raw.map((ch) => chainTvlSchema.parse(ch));

    chains.sort((a, b) => b.tvl - a.tvl);
    const limited = chains.slice(0, c.options.limit);

    const rows = limited.map((ch) => ({
      name: ch.name,
      tvl: formatUsd(ch.tvl),
    }));

    const topChain = limited[0]?.name.toLowerCase();

    return c.ok(
      {
        chains: rows,
        total: chains.length,
      },
      withCta(c.format, 'Next steps:', [
        {
          command: 'tvl protocols',
          options: { chain: topChain ?? true },
          description: 'Filter protocol rankings to a specific chain',
        },
      ]),
    );
  },
});

/* ── tvl protocol <slug> ────────────────────────────────────── */

tvlCli.command('protocol', {
  description: 'Get detailed protocol info with TVL breakdown by chain.',
  args: z.object({
    slug: z.string().describe('Protocol slug (e.g. aave, uniswap)'),
  }),
  output: z.object({
    name: z.string(),
    description: z.string(),
    category: z.string(),
    url: z.string(),
    symbol: z.string(),
    tvl: z.string(),
    chains: z.array(
      z.object({
        chain: z.string(),
        tvl: z.string(),
      }),
    ),
  }),
  examples: [{ args: { slug: 'aave' }, description: 'Aave protocol details' }],
  async run(c) {
    const client = createDefiLlamaClient();
    const raw = await client.get<unknown>('api', `/protocol/${c.args.slug}`);
    const detail = protocolDetailSchema.parse(raw);

    // Build chain breakdown from currentChainTvls (exclude borrowed, staking, pool2 keys)
    const chainBreakdown: Array<{ chain: string; tvl: string }> = [];
    if (detail.currentChainTvls) {
      for (const [chain, tvl] of Object.entries(detail.currentChainTvls)) {
        // Skip derivative entries (borrowed, staking, pool2, etc.)
        if (chain.includes('-')) {
          continue;
        }
        // Also skip aggregate keys
        if (['borrowed', 'staking', 'pool2'].includes(chain)) {
          continue;
        }
        chainBreakdown.push({ chain, tvl: formatUsd(tvl) });
      }
      chainBreakdown.sort((a, b) => {
        const aRaw = detail.currentChainTvls?.[a.chain] ?? 0;
        const bRaw = detail.currentChainTvls?.[b.chain] ?? 0;
        return bRaw - aRaw;
      });
    }

    // Compute current TVL from the most recent history point or sum of chain TVLs
    let currentTvl = 0;
    if (detail.tvl && detail.tvl.length > 0) {
      currentTvl = detail.tvl[detail.tvl.length - 1].totalLiquidityUSD;
    }

    return c.ok(
      {
        name: detail.name,
        description: detail.description ?? '—',
        category: detail.category ?? '—',
        url: detail.url ?? '—',
        symbol: detail.symbol ?? '—',
        tvl: formatUsd(currentTvl),
        chains: chainBreakdown,
      },
      withCta(c.format, 'Next steps:', [
        {
          command: 'tvl history',
          args: { slug: c.args.slug },
          options: { days: 30 },
          description: "View this protocol's recent TVL trend",
        },
      ]),
    );
  },
});

/* ── tvl history <slug> ─────────────────────────────────────── */

tvlCli.command('history', {
  description: 'Show historical TVL for a protocol.',
  args: z.object({
    slug: z.string().describe('Protocol slug (e.g. aave, uniswap)'),
  }),
  options: z.object({
    days: z.coerce.number().default(30).describe('Number of days of history to display'),
    chain: z.string().optional().describe('Filter to a specific chain'),
  }),
  output: z.object({
    protocol: z.string(),
    chain: z.string().optional(),
    days: z.number(),
    history: z.array(
      z.object({
        date: z.string(),
        tvl: z.string(),
      }),
    ),
  }),
  examples: [
    { args: { slug: 'aave' }, options: { days: 7 }, description: 'Aave 7-day TVL history' },
    {
      args: { slug: 'uniswap' },
      options: { days: 14, chain: 'Ethereum' },
      description: 'Uniswap Ethereum chain TVL over 14 days',
    },
  ],
  async run(c) {
    const client = createDefiLlamaClient();
    const raw = await client.get<unknown>('api', `/protocol/${c.args.slug}`);
    const detail = protocolDetailSchema.parse(raw);

    let tvlSeries: Array<{ date: number; totalLiquidityUSD: number }> = [];

    if (c.options.chain) {
      // Find chain-specific TVL history
      const chainLower = c.options.chain.toLowerCase();
      if (detail.chainTvls) {
        const matchKey = Object.keys(detail.chainTvls).find(
          (k) => k.toLowerCase() === chainLower && !k.includes('-'),
        );
        if (matchKey && detail.chainTvls[matchKey]?.tvl) {
          tvlSeries = detail.chainTvls[matchKey].tvl ?? [];
        }
      }
    } else if (detail.tvl) {
      tvlSeries = detail.tvl;
    }

    // Filter to last N days
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - c.options.days * 86400;
    const filtered = tvlSeries.filter((p) => p.date >= cutoff);

    const history = filtered.map((p) => ({
      date: new Date(p.date * 1000).toISOString().split('T')[0],
      tvl: formatUsd(p.totalLiquidityUSD),
    }));

    return c.ok(
      {
        protocol: detail.name,
        chain: c.options.chain,
        days: c.options.days,
        history,
      },
      withCta(c.format, 'Next steps:', [
        {
          command: 'tvl protocol',
          args: { slug: c.args.slug },
          description: 'Return to the current TVL and chain breakdown view',
        },
      ]),
    );
  },
});
