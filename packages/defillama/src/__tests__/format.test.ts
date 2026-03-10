import { describe, expect, it } from 'vitest';
import { formatDelta, formatNumber, formatUsd } from '../format.js';

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
});
