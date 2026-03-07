import { describe, expect, it } from 'vitest';
import { formatTimestamp, truncate, weiToEth } from '../utils/format.js';

describe('weiToEth', () => {
  it('converts 1 ETH in wei to "1"', () => {
    expect(weiToEth(1_000_000_000_000_000_000n)).toBe('1');
  });

  it('converts 0.5 ETH', () => {
    expect(weiToEth(500_000_000_000_000_000n)).toBe('0.5');
  });

  it('converts 0 wei', () => {
    expect(weiToEth(0n)).toBe('0');
  });

  it('accepts string input', () => {
    expect(weiToEth('1000000000000000000')).toBe('1');
  });

  it('respects decimals parameter', () => {
    const result = weiToEth(1_234_567_000_000_000_000n, 3);
    expect(result).toBe('1.234');
  });
});

describe('formatTimestamp', () => {
  it('formats unix timestamp to ISO string', () => {
    const result = formatTimestamp(0);
    expect(result).toBe('1970-01-01T00:00:00.000Z');
  });

  it('formats a known timestamp', () => {
    const result = formatTimestamp(1_700_000_000);
    expect(result).toMatch(/^2023-/);
  });
});

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('0x1234', 6, 4)).toBe('0x1234');
  });

  it('truncates long addresses', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678';
    const result = truncate(addr, 6, 4);
    expect(result).toBe('0x1234...5678');
  });

  it('uses default prefix/suffix lengths', () => {
    const result = truncate('abcdefghijklmnopqrstuvwxyz');
    expect(result).toContain('...');
    expect(result.startsWith('abcdef')).toBe(true);
  });
});
