import { describe, expect, it } from 'vitest';
import { formatDelta, formatNumber, formatPct, formatUsd } from '../format.js';

describe('formatDelta', () => {
  it('formats positive change', () => {
    expect(formatDelta(112.3, 100)).toBe('+12.3%');
  });

  it('formats negative change', () => {
    expect(formatDelta(94.9, 100)).toBe('-5.1%');
  });

  it('formats zero change', () => {
    expect(formatDelta(100, 100)).toBe('+0.0%');
  });

  it('handles previous = 0 with current > 0', () => {
    expect(formatDelta(50, 0)).toBe('+∞%');
  });

  it('handles previous = 0 with current < 0', () => {
    expect(formatDelta(-10, 0)).toBe('-∞%');
  });

  it('handles previous = 0 with current = 0', () => {
    expect(formatDelta(0, 0)).toBe('0.0%');
  });

  it('formats large percentage', () => {
    expect(formatDelta(300, 100)).toBe('+200.0%');
  });

  it('formats very small change', () => {
    expect(formatDelta(100.01, 100)).toBe('+0.0%');
  });

  it('handles negative previous value', () => {
    const result = formatDelta(50, -100);
    expect(result).toContain('%');
  });
});

describe('formatUsd', () => {
  it('formats trillions', () => {
    expect(formatUsd(1_500_000_000_000)).toBe('$1.50T');
  });

  it('formats billions', () => {
    expect(formatUsd(2_340_000_000)).toBe('$2.34B');
  });

  it('formats millions', () => {
    expect(formatUsd(1_230_000)).toBe('$1.23M');
  });

  it('formats thousands', () => {
    expect(formatUsd(456_000)).toBe('$456.00K');
  });

  it('formats small values', () => {
    expect(formatUsd(0.5)).toBe('$0.50');
  });

  it('formats negative values', () => {
    expect(formatUsd(-1_230_000)).toBe('-$1.23M');
  });

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('formats very large trillions', () => {
    expect(formatUsd(999_000_000_000_000)).toBe('$999.00T');
  });

  it('formats negative billions', () => {
    expect(formatUsd(-5_500_000_000)).toBe('-$5.50B');
  });

  it('formats negative thousands', () => {
    expect(formatUsd(-12_500)).toBe('-$12.50K');
  });

  it('formats sub-cent values', () => {
    expect(formatUsd(0.001)).toBe('$0.00');
  });

  it('formats exactly one thousand', () => {
    expect(formatUsd(1_000)).toBe('$1.00K');
  });

  it('formats exactly one million', () => {
    expect(formatUsd(1_000_000)).toBe('$1.00M');
  });

  it('formats exactly one billion', () => {
    expect(formatUsd(1_000_000_000)).toBe('$1.00B');
  });

  it('formats exactly one trillion', () => {
    expect(formatUsd(1_000_000_000_000)).toBe('$1.00T');
  });
});

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

  it('formats very large percentage', () => {
    expect(formatPct(9999.99)).toBe('+9999.99%');
  });

  it('formats very small negative percentage', () => {
    expect(formatPct(-0.01)).toBe('-0.01%');
  });
});

describe('formatNumber', () => {
  it('formats with comma separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('handles decimals', () => {
    expect(formatNumber(1234567.89)).toBe('1,234,567.89');
  });

  it('handles small numbers', () => {
    expect(formatNumber(42)).toBe('42');
  });

  it('handles zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('handles negative numbers', () => {
    const result = formatNumber(-1234567);
    expect(result).toContain('1,234,567');
    expect(result).toContain('-');
  });

  it('handles very large numbers', () => {
    const result = formatNumber(1_000_000_000_000);
    expect(result).toContain('1,000,000,000,000');
  });
});
