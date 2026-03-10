import { describe, expect, it } from 'vitest';
import { formatPct, formatUsd } from '../format.js';
import {
  type FeeEntry,
  type FeeOverviewResponse,
  type SummaryDetail,
  feeEntrySchema,
  feeOverviewResponseSchema,
  summaryDetailSchema,
} from '../types.js';

/* ── Schema parsing tests ───────────────────────────────────── */

describe('feeEntrySchema', () => {
  it('parses a full fee entry', () => {
    const input = {
      name: 'Aave',
      displayName: 'Aave',
      slug: 'aave',
      category: 'Lending',
      chains: ['Ethereum', 'Polygon'],
      total24h: 2_500_000,
      total7d: 15_000_000,
      total30d: 60_000_000,
      totalAllTime: 1_200_000_000,
      change_1d: 12.5,
    };
    const result = feeEntrySchema.parse(input);
    expect(result.name).toBe('Aave');
    expect(result.total24h).toBe(2_500_000);
    expect(result.change_1d).toBe(12.5);
    expect(result.category).toBe('Lending');
    expect(result.chains).toEqual(['Ethereum', 'Polygon']);
  });

  it('handles null and missing optional fields', () => {
    const input = {
      name: 'TestProto',
      total24h: null,
      change_1d: null,
    };
    const result = feeEntrySchema.parse(input);
    expect(result.total24h).toBeNull();
    expect(result.change_1d).toBeNull();
    expect(result.displayName).toBeUndefined();
    expect(result.totalAllTime).toBeUndefined();
  });
});

describe('feeOverviewResponseSchema', () => {
  it('parses a fee overview response', () => {
    const input = {
      protocols: [
        {
          name: 'Aave',
          displayName: 'Aave',
          total24h: 2_500_000,
          total7d: 15_000_000,
          total30d: 60_000_000,
          totalAllTime: 1_200_000_000,
          change_1d: 12.5,
        },
        {
          name: 'Lido',
          total24h: 5_000_000,
          total7d: 30_000_000,
          total30d: 120_000_000,
          change_1d: -3.2,
        },
      ],
      allChains: ['Ethereum', 'Solana', 'Base'],
      chain: null,
      total24h: 50_000_000,
      total7d: 300_000_000,
      total30d: 1_200_000_000,
      change_1d: 8.1,
    };
    const result = feeOverviewResponseSchema.parse(input);
    expect(result.protocols).toHaveLength(2);
    expect(result.protocols[0].name).toBe('Aave');
    expect(result.allChains).toHaveLength(3);
    expect(result.total24h).toBe(50_000_000);
  });

  it('handles minimal response', () => {
    const input = {
      protocols: [],
    };
    const result = feeOverviewResponseSchema.parse(input);
    expect(result.protocols).toHaveLength(0);
  });
});

/* ── Formatting integration tests ───────────────────────────── */

describe('Fee formatting integration', () => {
  it('formats fee row with all fields', () => {
    const entry: FeeEntry = {
      name: 'Aave',
      displayName: 'Aave',
      total24h: 2_500_000,
      total7d: 15_000_000,
      total30d: 60_000_000,
      totalAllTime: 1_200_000_000,
      change_1d: 12.5,
    };

    expect(formatUsd(entry.total24h ?? 0)).toBe('$2.50M');
    expect(formatUsd(entry.total7d ?? 0)).toBe('$15.00M');
    expect(formatPct(entry.change_1d)).toBe('+12.50%');
  });

  it('formats zero/null fees gracefully', () => {
    const entry: FeeEntry = {
      name: 'ZeroFees',
      total24h: 0,
      total7d: null,
      change_1d: null,
    };

    expect(formatUsd(entry.total24h ?? 0)).toBe('$0.00');
    expect(formatUsd(entry.total7d ?? 0)).toBe('$0.00');
    expect(formatPct(entry.change_1d)).toBe('—');
  });

  it('formats summary detail for fee protocol view', () => {
    const detail: SummaryDetail = {
      name: 'Aave',
      displayName: 'Aave',
      total24h: 2_500_000,
      total7d: 15_000_000,
      total30d: 60_000_000,
      totalAllTime: 1_200_000_000,
      change_1d: 12.5,
      change_7d: -3.2,
      change_1m: 25.0,
      chains: ['Ethereum', 'Polygon'],
    };

    expect(formatUsd(detail.total24h ?? 0)).toBe('$2.50M');
    expect(formatUsd(detail.totalAllTime ?? 0)).toBe('$1.20B');
    expect(formatPct(detail.change_1d)).toBe('+12.50%');
    expect(formatPct(detail.change_7d)).toBe('-3.20%');
    expect(formatPct(detail.change_1m)).toBe('+25.00%');
  });

  it('formats large all-time fees', () => {
    const entry: FeeEntry = {
      name: 'Ethereum',
      total24h: 10_000_000,
      totalAllTime: 15_400_000_000,
    };

    expect(formatUsd(entry.total24h ?? 0)).toBe('$10.00M');
    expect(formatUsd(entry.totalAllTime ?? 0)).toBe('$15.40B');
  });
});
