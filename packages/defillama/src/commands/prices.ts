import { Cli, z } from 'incur';
import { createDefiLlamaClient } from '../api.js';
import { formatUsd } from '../format.js';
import { chartResponseSchema, pricesResponseSchema } from '../types.js';

export const pricesCli = Cli.create('prices', {
  description: 'Token price queries via coins.llama.fi.',
});

/* ── Helpers ─────────────────────────────────────────────────── */

const COIN_ID_RE = /^[a-zA-Z0-9_-]+:0x[a-fA-F0-9]{1,}$/;

/**
 * Validate and normalise coin identifiers.
 * Accepts space-separated args that may themselves be comma-separated.
 * Returns a deduplicated, comma-joined string suitable for the API path.
 */
function parseCoins(raw: string[]): string {
  const coins: string[] = [];
  for (const arg of raw) {
    for (const part of arg.split(',')) {
      const trimmed = part.trim();
      if (trimmed.length === 0) continue;
      if (!COIN_ID_RE.test(trimmed)) {
        throw new Error(
          `Invalid coin identifier "${trimmed}". Expected format: chainName:0xAddress (e.g. ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7)`,
        );
      }
      coins.push(trimmed);
    }
  }
  if (coins.length === 0) {
    throw new Error('At least one coin identifier is required.');
  }
  return [...new Set(coins)].join(',');
}

/**
 * Parse a timestamp option that may be a Unix timestamp (seconds) or an ISO date string.
 * Returns a Unix timestamp in seconds.
 */
function parseTimestamp(value: string): number {
  // Pure numeric → treat as unix timestamp in seconds
  if (/^\d+$/.test(value)) {
    return Number(value);
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(
      `Invalid timestamp "${value}". Provide a Unix timestamp in seconds or an ISO date string (e.g. 2025-01-01 or 2025-01-01T00:00:00Z).`,
    );
  }
  return Math.floor(ms / 1000);
}

/* ── prices current ─────────────────────────────────────────── */

pricesCli.command('current', {
  description: 'Get current prices for one or more tokens.',
  args: z.object({
    coins: z.array(z.string()).describe('Coin identifiers (chainName:0xAddress)'),
  }),
  options: z.object({
    'search-width': z.string().default('4h').describe('Timestamp search width (e.g. 4h, 6h)'),
  }),
  output: z.object({
    prices: z.array(
      z.object({
        coin: z.string(),
        symbol: z.string(),
        price: z.string(),
        confidence: z.number().optional(),
        timestamp: z.string(),
      }),
    ),
  }),
  examples: [
    {
      args: { coins: ['ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7'] },
      description: 'Current price of USDT on Ethereum',
    },
  ],
  async run(c) {
    const coinsPath = parseCoins(c.args.coins);
    const client = createDefiLlamaClient();
    const searchWidth = c.options['search-width'];
    const path = `/prices/current/${coinsPath}?searchWidth=${searchWidth}`;
    const raw = await client.get<unknown>('coins', path);
    const data = pricesResponseSchema.parse(raw);

    const prices = Object.entries(data.coins).map(([coin, info]) => ({
      coin,
      symbol: info.symbol,
      price: formatUsd(info.price),
      confidence: info.confidence,
      timestamp: new Date(info.timestamp * 1000).toISOString(),
    }));

    return c.ok({ prices });
  },
});

/* ── prices historical ──────────────────────────────────────── */

pricesCli.command('historical', {
  description: 'Get token prices at a specific point in time.',
  args: z.object({
    coins: z.array(z.string()).describe('Coin identifiers (chainName:0xAddress)'),
  }),
  options: z.object({
    timestamp: z.string().optional().describe('Unix timestamp in seconds'),
    date: z.string().optional().describe('ISO date string (e.g. 2025-01-01)'),
    'search-width': z.string().default('4h').describe('Timestamp search width (e.g. 4h, 6h)'),
  }),
  output: z.object({
    prices: z.array(
      z.object({
        coin: z.string(),
        symbol: z.string(),
        price: z.string(),
        timestamp: z.string(),
      }),
    ),
  }),
  examples: [
    {
      args: { coins: ['ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7'] },
      options: { date: '2025-01-01' },
      description: 'USDT price on 2025-01-01',
    },
  ],
  async run(c) {
    const tsRaw = c.options.timestamp ?? c.options.date;
    if (!tsRaw) {
      throw new Error('Either --timestamp or --date is required for historical prices.');
    }
    const ts = parseTimestamp(tsRaw);
    const coinsPath = parseCoins(c.args.coins);
    const client = createDefiLlamaClient();
    const searchWidth = c.options['search-width'];
    const path = `/prices/historical/${ts}/${coinsPath}?searchWidth=${searchWidth}`;
    const raw = await client.get<unknown>('coins', path);
    const data = pricesResponseSchema.parse(raw);

    const prices = Object.entries(data.coins).map(([coin, info]) => ({
      coin,
      symbol: info.symbol,
      price: formatUsd(info.price),
      timestamp: new Date(info.timestamp * 1000).toISOString(),
    }));

    return c.ok({ prices });
  },
});

/* ── prices chart ───────────────────────────────────────────── */

pricesCli.command('chart', {
  description: 'Get a price chart over a time range.',
  args: z.object({
    coins: z.array(z.string()).describe('Coin identifiers (chainName:0xAddress)'),
  }),
  options: z.object({
    start: z.string().optional().describe('Start timestamp or ISO date'),
    end: z.string().optional().describe('End timestamp or ISO date (default: now)'),
    span: z.coerce.number().optional().describe('Number of data points'),
    period: z.string().optional().describe('Data point period (e.g. 1d, 1h, 4h)'),
    'search-width': z.string().default('4h').describe('Timestamp search width (e.g. 4h, 600)'),
  }),
  output: z.object({
    charts: z.array(
      z.object({
        coin: z.string(),
        symbol: z.string(),
        prices: z.array(
          z.object({
            date: z.string(),
            price: z.string(),
          }),
        ),
      }),
    ),
  }),
  examples: [
    {
      args: { coins: ['ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7'] },
      options: { start: '2025-01-01', period: '1d' },
      description: 'USDT daily price chart since 2025-01-01',
    },
  ],
  async run(c) {
    const coinsPath = parseCoins(c.args.coins);
    const client = createDefiLlamaClient();

    const params = new URLSearchParams();
    if (c.options.start) params.set('start', String(parseTimestamp(c.options.start)));
    if (c.options.end) params.set('end', String(parseTimestamp(c.options.end)));
    if (c.options.span) params.set('span', String(c.options.span));
    if (c.options.period) params.set('period', c.options.period);
    params.set('searchWidth', c.options['search-width']);

    const qs = params.toString();
    const path = `/chart/${coinsPath}${qs ? `?${qs}` : ''}`;
    const raw = await client.get<unknown>('coins', path);
    const data = chartResponseSchema.parse(raw);

    const charts = Object.entries(data.coins).map(([coin, info]) => ({
      coin,
      symbol: info.symbol,
      prices: info.prices.map((p) => ({
        date: new Date(p.timestamp * 1000).toISOString(),
        price: formatUsd(p.price),
      })),
    }));

    return c.ok({ charts });
  },
});
