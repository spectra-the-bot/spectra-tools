import { describe, expect, it } from 'vitest';
import { formatPct, formatUsd } from '../format.js';
import {
  type SummaryDetail,
  type VolumeEntry,
  type VolumeOverviewResponse,
  summaryDetailSchema,
  volumeEntrySchema,
  volumeOverviewResponseSchema,
} from '../types.js';

/* ── Schema parsing tests ───────────────────────────────────── */

describe('volumeEntrySchema', () => {
  it('parses a full volume entry', () => {
    const input = {
      name: 'Uniswap',
      displayName: 'Uniswap',
      slug: 'uniswap',
      category: 'Dexs',
      chains: ['Ethereum', 'Polygon', 'Base'],
      total24h: 1_780_351_091,
      total7d: 10_112_980_992,
      total30d: 52_552_249_639,
      totalAllTime: 3_578_994_905_487,
      change_1d: 66.19,
      change_7d: -5.2,
      change_1m: 12.3,
    };
    const result = volumeEntrySchema.parse(input);
    expect(result.name).toBe('Uniswap');
    expect(result.total24h).toBe(1_780_351_091);
    expect(result.change_1d).toBe(66.19);
    expect(result.category).toBe('Dexs');
    expect(result.chains).toEqual(['Ethereum', 'Polygon', 'Base']);
  });

  it('handles null and missing optional fields', () => {
    const input = {
      name: 'TestDex',
      total24h: null,
      change_1d: null,
    };
    const result = volumeEntrySchema.parse(input);
    expect(result.total24h).toBeNull();
    expect(result.change_1d).toBeNull();
    expect(result.displayName).toBeUndefined();
    expect(result.category).toBeUndefined();
  });
});

describe('volumeOverviewResponseSchema', () => {
  it('parses a volume overview response', () => {
    const input = {
      protocols: [
        {
          name: 'Uniswap',
          displayName: 'Uniswap',
          total24h: 1_780_000_000,
          total7d: 10_000_000_000,
          total30d: 50_000_000_000,
          change_1d: 66.19,
          change_7d: -5.2,
          change_1m: 12.3,
        },
        {
          name: 'Curve DEX',
          total24h: 143_000_000,
          total7d: 1_100_000_000,
          total30d: 4_370_000_000,
          change_1d: 101.88,
        },
      ],
      allChains: ['Ethereum', 'Solana', 'Base'],
      chain: null,
      total24h: 5_000_000_000,
      total7d: 30_000_000_000,
      total30d: 120_000_000_000,
      change_1d: 45.5,
    };
    const result = volumeOverviewResponseSchema.parse(input);
    expect(result.protocols).toHaveLength(2);
    expect(result.protocols[0].name).toBe('Uniswap');
    expect(result.allChains).toHaveLength(3);
    expect(result.total24h).toBe(5_000_000_000);
  });

  it('handles minimal response', () => {
    const input = {
      protocols: [],
    };
    const result = volumeOverviewResponseSchema.parse(input);
    expect(result.protocols).toHaveLength(0);
    expect(result.allChains).toBeUndefined();
  });
});

describe('summaryDetailSchema', () => {
  it('parses a volume summary detail', () => {
    const input = {
      name: 'Uniswap',
      displayName: 'Uniswap',
      slug: 'uniswap',
      category: null,
      chains: ['Ethereum', 'Polygon'],
      total24h: 1_780_351_091,
      total48hto24h: 1_071_302_431,
      total7d: 10_112_980_992,
      total30d: 52_552_249_639,
      totalAllTime: 3_578_994_905_487,
      change_1d: 66.19,
      change_7d: null,
      change_1m: null,
    };
    const result = summaryDetailSchema.parse(input);
    expect(result.name).toBe('Uniswap');
    expect(result.total24h).toBe(1_780_351_091);
    expect(result.totalAllTime).toBe(3_578_994_905_487);
    expect(result.category).toBeNull();
  });

  it('handles minimal summary detail', () => {
    const input = {
      name: 'MinimalProto',
    };
    const result = summaryDetailSchema.parse(input);
    expect(result.name).toBe('MinimalProto');
    expect(result.total24h).toBeUndefined();
    expect(result.chains).toBeUndefined();
  });
});

/* ── Formatting integration tests ───────────────────────────── */

describe('Volume formatting integration', () => {
  it('formats volume row with all fields', () => {
    const entry: VolumeEntry = {
      name: 'Uniswap',
      displayName: 'Uniswap',
      total24h: 1_780_351_091,
      total7d: 10_112_980_992,
      total30d: 52_552_249_639,
      change_1d: 66.19,
      change_7d: -5.2,
      change_1m: 12.3,
    };

    expect(formatUsd(entry.total24h ?? 0)).toBe('$1.78B');
    expect(formatUsd(entry.total7d ?? 0)).toBe('$10.11B');
    expect(formatPct(entry.change_1d)).toBe('+66.19%');
  });

  it('formats zero/null volume gracefully', () => {
    const entry: VolumeEntry = {
      name: 'ZeroDex',
      total24h: 0,
      total7d: null,
      change_1d: null,
    };

    expect(formatUsd(entry.total24h ?? 0)).toBe('$0.00');
    expect(formatUsd(entry.total7d ?? 0)).toBe('$0.00');
    expect(formatPct(entry.change_1d)).toBe('—');
  });

  it('formats summary detail for protocol view', () => {
    const detail: SummaryDetail = {
      name: 'Curve DEX',
      displayName: 'Curve DEX',
      total24h: 143_131_717,
      total7d: 1_102_723_987,
      total30d: 4_370_847_085,
      totalAllTime: 327_449_525_450,
      change_1d: 101.88,
      change_7d: -37.92,
      change_1m: -19.93,
      chains: ['Ethereum', 'Arbitrum'],
    };

    expect(formatUsd(detail.total24h ?? 0)).toBe('$143.13M');
    expect(formatUsd(detail.totalAllTime ?? 0)).toBe('$327.45B');
    expect(formatPct(detail.change_1d)).toBe('+101.88%');
    expect(formatPct(detail.change_7d)).toBe('-37.92%');
  });
});
