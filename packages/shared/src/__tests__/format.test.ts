import { describe, expect, it } from 'vitest';
import { checksumAddress, formatTimestamp, truncate, weiToEth } from '../utils/format.js';

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

describe('checksumAddress', () => {
  it('produces known EIP-55 checksums from lowercase addresses', () => {
    expect(checksumAddress('0x52908400098527886e0f7030069857d2e4169ee7')).toBe(
      '0x52908400098527886E0F7030069857D2E4169EE7',
    );
    expect(checksumAddress('0x8617e340b3d01fa5f11f306f4090fd50e238070d')).toBe(
      '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
    );
    expect(checksumAddress('0xde709f2102306220921060314715629080e2fb77')).toBe(
      '0xde709f2102306220921060314715629080e2fb77',
    );
    expect(checksumAddress('0x27b1fdb04752bbc536007a920d24acb045561c26')).toBe(
      '0x27b1fdb04752bbc536007a920d24acb045561c26',
    );
  });

  it('normalizes mixed-case input to the canonical EIP-55 checksum', () => {
    expect(checksumAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
    expect(checksumAddress('0xFB6916095ca1df60bb79ce92ce3ea74c37c5d359')).toBe(
      '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    );
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
