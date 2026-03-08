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
    `The contract function "${functionName}" reverted.\n\nContract Call:\n  address: 0x8004cc8439f36fd5f9f049d9ff86523df6daab58\n\nDocs: https://viem.sh/docs/contract/readContract\nVersion: viem@2.x`,
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

describe('validation status — contract revert handling', () => {
  it('returns VALIDATION_NOT_FOUND when getValidationStatus reverts', async () => {
    mockReadContract.mockRejectedValue(makeContractRevertError('getValidationStatus'));

    const output = await collectOutput(['validation', 'status', '999', '--json'], {
      VALIDATION_REGISTRY_ADDRESS: '0x8004cc8439f36fd5f9f049d9ff86523df6daab58',
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_NOT_FOUND');
    expect(envelope.message).toContain('No validation request found');
  });
});

describe('validation history — contract revert handling', () => {
  it('returns AGENT_NOT_FOUND when getValidationCount reverts', async () => {
    mockReadContract.mockRejectedValue(makeContractRevertError('getValidationCount'));

    const output = await collectOutput(['validation', 'history', '999', '--json'], {
      VALIDATION_REGISTRY_ADDRESS: '0x8004cc8439f36fd5f9f049d9ff86523df6daab58',
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('AGENT_NOT_FOUND');
    expect(envelope.message).toContain('No validation history found');
  });
});
