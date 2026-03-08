import { describe, expect, it } from 'vitest';
import {
  getIdentityRegistryAddress,
  getReputationRegistryAddress,
  getValidationRegistryAddress,
} from '../contracts/client.js';

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

  it('defaults reputation registry on Abstract mainnet', () => {
    expect(getReputationRegistryAddress({})).toBe('0x8004baa17c55a88189ae136b182e5fda19de9b63');
  });

  it('defaults validation registry on Abstract mainnet', () => {
    expect(getValidationRegistryAddress({})).toBe('0x8004cc8439f36fd5f9f049d9ff86523df6daab58');
  });

  it('accepts --registry style overrides', () => {
    expect(getReputationRegistryAddress({}, '0x1234567890123456789012345678901234567890')).toBe(
      '0x1234567890123456789012345678901234567890',
    );

    expect(getValidationRegistryAddress({}, '0x1234567890123456789012345678901234567890')).toBe(
      '0x1234567890123456789012345678901234567890',
    );
  });
});
