import { describe, expect, it } from 'vitest';
import { getIdentityRegistryAddress } from '../contracts/client.js';

describe('contracts client', () => {
  it('uses IDENTITY_REGISTRY_ADDRESS when provided', () => {
    const address = getIdentityRegistryAddress({
      IDENTITY_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
    });

    expect(address).toBe('0x1234567890123456789012345678901234567890');
  });

  it('defaults identity registry address to Abstract mainnet deployment', () => {
    const address = getIdentityRegistryAddress({ IDENTITY_REGISTRY_ADDRESS: undefined });

    expect(address).toBe('0x8004a169fb4a3325136eb29fa0ceb6d2e539a432');
  });

  it('throws when chain is not Abstract mainnet and env override is missing', () => {
    expect(() => getIdentityRegistryAddress({ CHAIN_ID: '1' })).toThrow(
      'IDENTITY_REGISTRY_ADDRESS is not set. Export it or pass via env.',
    );
  });
});
