import { describe, expect, it } from 'vitest';
import { formatPct, formatUsd } from '../format.js';
import {
  type ChainTvl,
  type ProtocolDetail,
  type ProtocolSummary,
  chainTvlSchema,
  protocolDetailSchema,
  protocolSummarySchema,
  tvlHistoryPointSchema,
} from '../types.js';

/* ── Schema parsing tests ───────────────────────────────────── */

describe('protocolSummarySchema', () => {
  it('parses a full protocol summary', () => {
    const input = {
      id: '1',
      name: 'Aave',
      slug: 'aave',
      symbol: 'AAVE',
      category: 'Lending',
      chains: ['Ethereum', 'Polygon'],
      tvl: 12_345_678_901,
      change_1h: -0.15,
      change_1d: 2.34,
      change_7d: -1.56,
      mcap: 5_000_000_000,
    };
    const result = protocolSummarySchema.parse(input);
    expect(result.name).toBe('Aave');
    expect(result.tvl).toBe(12_345_678_901);
    expect(result.change_1d).toBe(2.34);
  });

  it('handles null and missing optional fields', () => {
    const input = {
      id: '2',
      name: 'TestProto',
      slug: 'testproto',
      tvl: null,
      change_1d: null,
    };
    const result = protocolSummarySchema.parse(input);
    expect(result.tvl).toBeNull();
    expect(result.change_1d).toBeNull();
    expect(result.category).toBeUndefined();
  });
});

describe('chainTvlSchema', () => {
  it('parses a chain entry', () => {
    const input = {
      gecko_id: 'ethereum',
      tvl: 50_000_000_000,
      tokenSymbol: 'ETH',
      cmcId: '1027',
      name: 'Ethereum',
      chainId: 1,
    };
    const result = chainTvlSchema.parse(input);
    expect(result.name).toBe('Ethereum');
    expect(result.tvl).toBe(50_000_000_000);
  });

  it('handles null optional fields', () => {
    const input = {
      gecko_id: null,
      tvl: 1_000_000,
      name: 'SomeChain',
      chainId: null,
    };
    const result = chainTvlSchema.parse(input);
    expect(result.gecko_id).toBeNull();
    expect(result.chainId).toBeNull();
  });
});

describe('protocolDetailSchema', () => {
  it('parses protocol detail response', () => {
    const input = {
      id: '1',
      name: 'Aave',
      url: 'https://aave.com',
      description: 'Aave is a lending protocol',
      symbol: 'AAVE',
      category: 'Lending',
      chains: ['Ethereum', 'Polygon'],
      tvl: [
        { date: 1700000000, totalLiquidityUSD: 10_000_000 },
        { date: 1700086400, totalLiquidityUSD: 10_500_000 },
      ],
      currentChainTvls: {
        Ethereum: 8_000_000,
        Polygon: 2_500_000,
      },
      chainTvls: {
        Ethereum: {
          tvl: [
            { date: 1700000000, totalLiquidityUSD: 7_500_000 },
            { date: 1700086400, totalLiquidityUSD: 8_000_000 },
          ],
        },
      },
      mcap: 5_000_000_000,
    };
    const result = protocolDetailSchema.parse(input);
    expect(result.name).toBe('Aave');
    expect(result.tvl).toHaveLength(2);
    expect(result.currentChainTvls?.Ethereum).toBe(8_000_000);
    expect(result.chainTvls?.Ethereum?.tvl).toHaveLength(2);
  });

  it('handles minimal protocol detail', () => {
    const input = {
      id: '99',
      name: 'MinimalProto',
    };
    const result = protocolDetailSchema.parse(input);
    expect(result.name).toBe('MinimalProto');
    expect(result.tvl).toBeUndefined();
    expect(result.currentChainTvls).toBeUndefined();
  });
});

describe('tvlHistoryPointSchema', () => {
  it('parses a history point', () => {
    const result = tvlHistoryPointSchema.parse({
      date: 1700000000,
      totalLiquidityUSD: 42_000_000,
    });
    expect(result.date).toBe(1700000000);
    expect(result.totalLiquidityUSD).toBe(42_000_000);
  });
});

/* ── formatPct tests ────────────────────────────────────────── */

describe('formatPct', () => {
  it('formats positive percentage', () => {
    expect(formatPct(12.345)).toBe('+12.35%');
  });

  it('formats negative percentage', () => {
    expect(formatPct(-5.1)).toBe('-5.10%');
  });

  it('formats zero', () => {
    expect(formatPct(0)).toBe('+0.00%');
  });

  it('returns dash for null', () => {
    expect(formatPct(null)).toBe('—');
  });

  it('returns dash for undefined', () => {
    expect(formatPct(undefined)).toBe('—');
  });
});

/* ── Formatting integration tests ───────────────────────────── */

describe('TVL formatting integration', () => {
  it('formats protocol row with all fields', () => {
    const protocol: ProtocolSummary = {
      id: '1',
      name: 'Aave',
      slug: 'aave',
      symbol: 'AAVE',
      category: 'Lending',
      chains: ['Ethereum'],
      tvl: 12_345_000_000,
      change_1h: -0.15,
      change_1d: 2.34,
      change_7d: -1.56,
      mcap: 5_000_000_000,
    };

    expect(formatUsd(protocol.tvl ?? 0)).toBe('$12.35B');
    expect(formatPct(protocol.change_1d)).toBe('+2.34%');
    expect(formatPct(protocol.change_7d)).toBe('-1.56%');
  });

  it('formats chain TVL entry', () => {
    const chain: ChainTvl = {
      gecko_id: 'ethereum',
      tvl: 50_123_456_789,
      tokenSymbol: 'ETH',
      cmcId: '1027',
      name: 'Ethereum',
      chainId: 1,
    };

    expect(formatUsd(chain.tvl)).toBe('$50.12B');
  });

  it('formats protocol detail chain breakdown', () => {
    const detail: ProtocolDetail = {
      id: '1',
      name: 'Test',
      currentChainTvls: {
        Ethereum: 8_000_000,
        'Ethereum-borrowed': 5_000_000,
        Polygon: 2_500_000,
        staking: 1_000_000,
      },
    };

    // Filter derivative keys
    const chains = Object.entries(detail.currentChainTvls ?? {})
      .filter(([k]) => !k.includes('-') && !['borrowed', 'staking', 'pool2'].includes(k))
      .map(([chain, tvl]) => ({ chain, tvl: formatUsd(tvl) }));

    expect(chains).toEqual([
      { chain: 'Ethereum', tvl: '$8.00M' },
      { chain: 'Polygon', tvl: '$2.50M' },
    ]);
  });

  it('formats history points as date + USD', () => {
    const points = [
      { date: 1700000000, totalLiquidityUSD: 10_000_000 },
      { date: 1700086400, totalLiquidityUSD: 10_500_000 },
    ];

    const formatted = points.map((p) => ({
      date: new Date(p.date * 1000).toISOString().split('T')[0],
      tvl: formatUsd(p.totalLiquidityUSD),
    }));

    expect(formatted[0].date).toBe('2023-11-14');
    expect(formatted[0].tvl).toBe('$10.00M');
    expect(formatted[1].tvl).toBe('$10.50M');
  });
});
