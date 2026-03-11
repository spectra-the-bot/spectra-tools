import { describe, expect, it } from 'vitest';
import { normalizePricesArgv } from '../cli.js';
import { normalizeCoinArgs, parseCoins } from '../commands/prices.js';
import { formatUsd } from '../format.js';
import {
  type CoinChart,
  type CoinPrice,
  type PricesResponse,
  chartResponseSchema,
  coinChartSchema,
  coinPriceSchema,
  pricesResponseSchema,
} from '../types.js';

/* ── Coin arg parsing tests ─────────────────────────────────── */

describe('coin arg parsing', () => {
  it('normalizes a single positional coin arg string', () => {
    const coin = 'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    expect(normalizeCoinArgs(coin)).toEqual([coin]);
  });

  it('rewrites multi-coin positional argv for prices subcommands', () => {
    const weth = 'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const dai = 'ethereum:0x6b175474e89094c44da98b954eedeac495271d0f';

    expect(normalizePricesArgv(['prices', 'current', weth, dai])).toEqual([
      'prices',
      'current',
      `${weth},${dai}`,
    ]);
  });

  it('accepts a single coin string in parseCoins', () => {
    const coin = 'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    expect(parseCoins(coin)).toBe(coin);
  });

  it('accepts multiple positional coin args in parseCoins', () => {
    const weth = 'ethereum:0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const dai = 'ethereum:0x6b175474e89094c44da98b954eedeac495271d0f';
    expect(parseCoins([weth, dai])).toBe(`${weth},${dai}`);
  });
});

/* ── Schema parsing tests ───────────────────────────────────── */

describe('coinPriceSchema', () => {
  it('parses a full coin price entry', () => {
    const input = {
      price: 1.001,
      decimals: 6,
      symbol: 'USDT',
      timestamp: 1700000000,
      confidence: 0.99,
    };
    const result = coinPriceSchema.parse(input);
    expect(result.price).toBe(1.001);
    expect(result.symbol).toBe('USDT');
    expect(result.timestamp).toBe(1700000000);
    expect(result.confidence).toBe(0.99);
    expect(result.decimals).toBe(6);
  });

  it('handles missing optional fields', () => {
    const input = {
      price: 2345.67,
      symbol: 'ETH',
      timestamp: 1700000000,
    };
    const result = coinPriceSchema.parse(input);
    expect(result.price).toBe(2345.67);
    expect(result.decimals).toBeUndefined();
    expect(result.confidence).toBeUndefined();
  });
});

describe('pricesResponseSchema', () => {
  it('parses a multi-coin response', () => {
    const input = {
      coins: {
        'ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7': {
          price: 1.001,
          decimals: 6,
          symbol: 'USDT',
          timestamp: 1700000000,
          confidence: 0.99,
        },
        'ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': {
          price: 0.9998,
          decimals: 6,
          symbol: 'USDC',
          timestamp: 1700000000,
          confidence: 0.98,
        },
      },
    };
    const result = pricesResponseSchema.parse(input);
    expect(Object.keys(result.coins)).toHaveLength(2);
    expect(result.coins['ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7'].symbol).toBe('USDT');
    expect(result.coins['ethereum:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'].price).toBe(0.9998);
  });

  it('parses empty coins map', () => {
    const result = pricesResponseSchema.parse({ coins: {} });
    expect(Object.keys(result.coins)).toHaveLength(0);
  });
});

describe('coinChartSchema', () => {
  it('parses a chart entry with prices array', () => {
    const input = {
      decimals: 18,
      symbol: 'WETH',
      prices: [
        { timestamp: 1700000000, price: 2000.5 },
        { timestamp: 1700086400, price: 2050.75 },
        { timestamp: 1700172800, price: 1980.25 },
      ],
      confidence: 0.95,
    };
    const result = coinChartSchema.parse(input);
    expect(result.symbol).toBe('WETH');
    expect(result.prices).toHaveLength(3);
    expect(result.prices[0].timestamp).toBe(1700000000);
    expect(result.prices[1].price).toBe(2050.75);
  });

  it('handles empty prices array', () => {
    const input = {
      symbol: 'TEST',
      prices: [],
    };
    const result = coinChartSchema.parse(input);
    expect(result.prices).toHaveLength(0);
    expect(result.decimals).toBeUndefined();
    expect(result.confidence).toBeUndefined();
  });
});

describe('chartResponseSchema', () => {
  it('parses a multi-coin chart response', () => {
    const input = {
      coins: {
        'ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7': {
          decimals: 6,
          symbol: 'USDT',
          prices: [
            { timestamp: 1700000000, price: 1.001 },
            { timestamp: 1700086400, price: 0.999 },
          ],
          confidence: 0.99,
        },
      },
    };
    const result = chartResponseSchema.parse(input);
    const usdt = result.coins['ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7'];
    expect(usdt.symbol).toBe('USDT');
    expect(usdt.prices).toHaveLength(2);
  });
});

/* ── Formatting integration tests ───────────────────────────── */

describe('Prices formatting integration', () => {
  it('formats current price output', () => {
    const data: PricesResponse = {
      coins: {
        'ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7': {
          price: 1.001,
          decimals: 6,
          symbol: 'USDT',
          timestamp: 1700000000,
          confidence: 0.99,
        },
      },
    };

    const prices = Object.entries(data.coins).map(([coin, info]) => ({
      coin,
      symbol: info.symbol,
      price: formatUsd(info.price),
      confidence: info.confidence,
      timestamp: new Date(info.timestamp * 1000).toISOString(),
    }));

    expect(prices).toHaveLength(1);
    expect(prices[0].symbol).toBe('USDT');
    expect(prices[0].price).toBe('$1.00');
    expect(prices[0].confidence).toBe(0.99);
    expect(prices[0].timestamp).toBe('2023-11-14T22:13:20.000Z');
  });

  it('formats high-value token price correctly', () => {
    const price: CoinPrice = {
      price: 95432.15,
      symbol: 'BTC',
      timestamp: 1700000000,
      decimals: 8,
    };
    expect(formatUsd(price.price)).toBe('$95.43K');
  });

  it('formats chart data as time series', () => {
    const chart: CoinChart = {
      symbol: 'WETH',
      prices: [
        { timestamp: 1700000000, price: 2000.5 },
        { timestamp: 1700086400, price: 2050.75 },
      ],
    };

    const formatted = chart.prices.map((p) => ({
      date: new Date(p.timestamp * 1000).toISOString(),
      price: formatUsd(p.price),
    }));

    expect(formatted).toEqual([
      { date: '2023-11-14T22:13:20.000Z', price: '$2.00K' },
      { date: '2023-11-15T22:13:20.000Z', price: '$2.05K' },
    ]);
  });

  it('formats sub-dollar prices with cents', () => {
    const price: CoinPrice = {
      price: 0.00045,
      symbol: 'SHIB',
      timestamp: 1700000000,
    };
    expect(formatUsd(price.price)).toBe('$0.00');
  });

  it('handles multiple coins in a single response', () => {
    const data: PricesResponse = {
      coins: {
        'ethereum:0xAAA': {
          price: 1.0,
          symbol: 'USDT',
          timestamp: 1700000000,
          confidence: 0.99,
        },
        'ethereum:0xBBB': {
          price: 2500.0,
          symbol: 'ETH',
          timestamp: 1700000000,
          confidence: 0.95,
        },
        'ethereum:0xCCC': {
          price: 50000.0,
          symbol: 'BTC',
          timestamp: 1700000000,
        },
      },
    };

    const coins = Object.entries(data.coins);
    expect(coins).toHaveLength(3);

    const formatted = coins.map(([coin, info]) => ({
      coin,
      price: formatUsd(info.price),
    }));

    expect(formatted).toContainEqual({ coin: 'ethereum:0xAAA', price: '$1.00' });
    expect(formatted).toContainEqual({ coin: 'ethereum:0xBBB', price: '$2.50K' });
    expect(formatted).toContainEqual({ coin: 'ethereum:0xCCC', price: '$50.00K' });
  });
});
