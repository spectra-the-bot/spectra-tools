import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock viem/actions to simulate contract revert errors.
 * The mock must be hoisted before the CLI import.
 */
vi.mock('viem/actions', () => ({
  readContract: vi.fn(),
  writeContract: vi.fn(),
}));

import { readContract } from 'viem/actions';
import { cli } from '../cli.js';

const mockReadContract = vi.mocked(readContract);

afterEach(() => {
  vi.restoreAllMocks();
});

function makeContractRevertError(functionName: string): Error {
  const err = new Error(
    `The contract function "${functionName}" reverted.\n\nContract Call:\n  address: 0x8004baa17c55a88189ae136b182e5fda19de9b63\n\nDocs: https://viem.sh/docs/contract/readContract\nVersion: viem@2.x`,
  );
  err.name = 'ContractFunctionExecutionError';
  (err as Error & { shortMessage: string }).shortMessage =
    `The contract function "${functionName}" reverted.`;
  return err;
}

function collectOutput(args: string[], env?: Record<string, string | undefined>): Promise<string> {
  let output = '';
  return cli
    .serve(args, {
      stdout(s) {
        output += s;
      },
      exit() {},
      env,
    })
    .then(() => output);
}

describe('reputation get — contract revert handling', () => {
  it('returns AGENT_NOT_FOUND when getScore reverts', async () => {
    // Must reject persistently since withRetry retries up to 3 times
    mockReadContract.mockRejectedValue(makeContractRevertError('getScore'));

    const output = await collectOutput(['reputation', 'get', '999', '--json'], {
      REPUTATION_REGISTRY_ADDRESS: '0x8004baa17c55a88189ae136b182e5fda19de9b63',
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('AGENT_NOT_FOUND');
    expect(envelope.message).toContain('No reputation data found');
  });
});

describe('reputation history — contract revert handling', () => {
  it('returns AGENT_NOT_FOUND when getFeedbackCount reverts', async () => {
    mockReadContract.mockRejectedValue(makeContractRevertError('getFeedbackCount'));

    const output = await collectOutput(['reputation', 'history', '999', '--json'], {
      REPUTATION_REGISTRY_ADDRESS: '0x8004baa17c55a88189ae136b182e5fda19de9b63',
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('AGENT_NOT_FOUND');
    expect(envelope.message).toContain('No feedback history found');
  });
});
