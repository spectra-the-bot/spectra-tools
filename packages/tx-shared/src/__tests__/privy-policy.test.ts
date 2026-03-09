import type { Address } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import {
  type PrivyClient,
  fetchPrivyPolicyVisibility,
  normalizePrivyPolicy,
  preflightPrivyTransactionPolicy,
  toPrivyPolicyViolationError,
} from '../signers/privy-client.js';

const ALLOWED_CONTRACT = '0x1111111111111111111111111111111111111111' as Address;
const OTHER_CONTRACT = '0x2222222222222222222222222222222222222222' as Address;

function createMockClient(policyRules: unknown[]): PrivyClient {
  const getWallet = vi.fn(async () => ({
    id: 'wallet-id-1234',
    address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    owner_id: null,
    policy_ids: ['policy-1'],
  }));

  const getPolicy = vi.fn(async (_policyId: string) => ({
    id: 'policy-1',
    owner_id: null,
    rules: policyRules,
  }));

  return {
    appId: 'app-id-1234',
    walletId: 'wallet-id-1234',
    apiUrl: 'https://api.privy.io',
    createRpcIntent: vi.fn(),
    getWallet,
    getPolicy,
  };
}

describe('privy policy preflight', () => {
  it('normalizes policy constraints and visibility from wallet policies', async () => {
    const client = createMockClient([
      {
        constraints: {
          allowed_contracts: [ALLOWED_CONTRACT],
          max_value_wei: '1000',
        },
      },
      {
        constraints: {
          max_value_wei: '2500',
        },
      },
    ]);

    const visibility = await fetchPrivyPolicyVisibility(client);

    expect(visibility).toMatchObject({
      walletId: 'wallet-id-1234',
      policyIds: ['policy-1'],
      contractAllowlist: [ALLOWED_CONTRACT],
      maxValueWei: 1000n,
    });
  });

  it('blocks transactions that violate allowlist or value cap with deterministic TxError text', async () => {
    const client = createMockClient([
      {
        constraints: {
          contract_allowlist: [ALLOWED_CONTRACT],
          value_cap_wei: '500',
        },
      },
    ]);

    const result = await preflightPrivyTransactionPolicy(client, {
      to: OTHER_CONTRACT,
      value: 900n,
    });

    expect(result.status).toBe('blocked');
    expect(result.violations).toHaveLength(2);

    const error = toPrivyPolicyViolationError(result);
    expect(error.code).toBe('PRIVY_POLICY_BLOCKED');
    expect(error.message).toContain('Target contract');
    expect(error.message).toContain('Native value 900 exceeds Privy policy max 500');
  });

  it('normalizes individual policy models', () => {
    const normalized = normalizePrivyPolicy({
      id: 'policy-xyz',
      owner_id: 'owner-1',
      rules: [
        {
          constraints: {
            allowed_contracts: [ALLOWED_CONTRACT],
            max_value_wei: '42',
          },
        },
      ],
    });

    expect(normalized).toEqual({
      id: 'policy-xyz',
      ownerId: 'owner-1',
      ruleCount: 1,
      allowlistedContracts: [ALLOWED_CONTRACT],
      maxValueWei: 42n,
    });
  });
});
