import { describe, expect, it } from 'vitest';
import { resolveChainId, CHAIN_IDS, DEFAULT_CHAIN } from '../chains.js';

describe('resolveChainId', () => {
  it('resolves abstract chain to 2741', () => {
    expect(resolveChainId('abstract')).toBe(2741);
  });

  it('resolves ethereum to 1', () => {
    expect(resolveChainId('ethereum')).toBe(1);
  });

  it('resolves mainnet to 1', () => {
    expect(resolveChainId('mainnet')).toBe(1);
  });

  it('resolves base to 8453', () => {
    expect(resolveChainId('base')).toBe(8453);
  });

  it('resolves arbitrum to 42161', () => {
    expect(resolveChainId('arbitrum')).toBe(42161);
  });

  it('is case-insensitive', () => {
    expect(resolveChainId('ABSTRACT')).toBe(2741);
    expect(resolveChainId('Ethereum')).toBe(1);
  });

  it('throws for unknown chain', () => {
    expect(() => resolveChainId('unknownchain')).toThrow('Unknown chain "unknownchain"');
  });

  it('includes supported chains in error message', () => {
    expect(() => resolveChainId('notreal')).toThrow('Supported chains:');
  });
});

describe('DEFAULT_CHAIN', () => {
  it('defaults to abstract', () => {
    expect(DEFAULT_CHAIN).toBe('abstract');
  });

  it('is present in CHAIN_IDS', () => {
    expect(CHAIN_IDS[DEFAULT_CHAIN]).toBe(2741);
  });
});
