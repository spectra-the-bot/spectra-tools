import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Mock viem/actions to simulate contract revert errors.
 * The mock must be hoisted before the CLI import.
 */
vi.mock('viem/actions', () => ({
  readContract: vi.fn(),
  writeContract: vi.fn(),
  simulateContract: vi.fn(),
}));

import { readContract, simulateContract, writeContract } from 'viem/actions';
import { cli } from '../cli.js';

const mockReadContract = vi.mocked(readContract);
const mockWriteContract = vi.mocked(writeContract);
const mockSimulateContract = vi.mocked(simulateContract);

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

const REGISTRY_ADDR = '0x8004cc8439f36fd5f9f049d9ff86523df6daab58';
// A valid-looking 0x-prefixed private key (32 bytes hex)
const FAKE_PRIVATE_KEY = `0x${'ab'.repeat(32)}`;

describe('validation status — contract revert handling', () => {
  it('returns VALIDATION_NOT_FOUND when getValidationStatus reverts', async () => {
    mockReadContract.mockRejectedValue(makeContractRevertError('getValidationStatus'));

    const output = await collectOutput(['validation', 'status', '999', '--json'], {
      VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
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
      VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('AGENT_NOT_FOUND');
    expect(envelope.message).toContain('No validation history found');
  });
});

// -----------------------------------------------------------------------
// submit-result
// -----------------------------------------------------------------------

describe('validation submit-result', () => {
  it('errors without PRIVATE_KEY', async () => {
    const output = await collectOutput(
      [
        'validation',
        'submit-result',
        '1',
        '--status',
        'pass',
        '--result',
        'All checks passed',
        '--json',
      ],
      {
        VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
        PRIVATE_KEY: undefined,
      },
    );

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('NO_PRIVATE_KEY');
  });

  it('errors on non-numeric requestId', async () => {
    const output = await collectOutput(
      ['validation', 'submit-result', 'notanumber', '--status', 'pass', '--result', 'ok', '--json'],
      {
        VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
        PRIVATE_KEY: FAKE_PRIVATE_KEY,
      },
    );

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_ERROR');
    expect(envelope.message).toContain('requestId must be a numeric value');
  });

  it('returns VALIDATION_NOT_FOUND when getValidationStatus reverts', async () => {
    mockReadContract.mockRejectedValue(makeContractRevertError('getValidationStatus'));

    const output = await collectOutput(
      ['validation', 'submit-result', '999', '--status', 'pass', '--result', 'ok', '--json'],
      {
        VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
        PRIVATE_KEY: FAKE_PRIVATE_KEY,
      },
    );

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_NOT_FOUND');
  });

  it('returns VALIDATION_NOT_PENDING when request is not in Pending status', async () => {
    // status=1 means Passed (not Pending=0)
    mockReadContract.mockResolvedValue([
      1n,
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      '0x00',
      1,
      'Already passed',
      1700000000n,
    ]);

    const output = await collectOutput(
      ['validation', 'submit-result', '1', '--status', 'pass', '--result', 'ok', '--json'],
      {
        VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
        PRIVATE_KEY: FAKE_PRIVATE_KEY,
      },
    );

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_NOT_PENDING');
    expect(envelope.message).toContain('Passed');
  });

  it('returns NOT_VALIDATOR when caller is not the designated validator', async () => {
    // Return Pending status (0) with a different validator address
    mockReadContract.mockResolvedValue([
      1n,
      '0x1111111111111111111111111111111111111111',
      '0x00',
      0,
      '',
      1700000000n,
    ]);

    const output = await collectOutput(
      ['validation', 'submit-result', '1', '--status', 'pass', '--result', 'ok', '--json'],
      {
        VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
        PRIVATE_KEY: FAKE_PRIVATE_KEY,
      },
    );

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('NOT_VALIDATOR');
    expect(envelope.message).toContain('not the designated validator');
  });

  it('supports --dry-run simulation', async () => {
    // The private key 0xabab...ab resolves to a deterministic address via viem
    // We need the validator address to match the wallet's address
    // Instead, let's mock readContract to return the wallet address as validator
    // The wallet address for the FAKE_PRIVATE_KEY is deterministic
    const { privateKeyToAccount } = await import('viem/accounts');
    const account = privateKeyToAccount(FAKE_PRIVATE_KEY as `0x${string}`);

    mockReadContract.mockResolvedValue([
      1n,
      account.address,
      '0x00',
      0, // Pending
      '',
      1700000000n,
    ]);

    mockSimulateContract.mockResolvedValue({ result: undefined } as never);

    const output = await collectOutput(
      [
        'validation',
        'submit-result',
        '1',
        '--status',
        'pass',
        '--result',
        'All checks passed',
        '--dry-run',
        '--json',
      ],
      {
        VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
        PRIVATE_KEY: FAKE_PRIVATE_KEY,
      },
    );

    const envelope = JSON.parse(output);
    expect(envelope.dryRun).toBe(true);
    expect(envelope.simulationOk).toBe(true);
    expect(envelope.status).toBe('Passed');
    expect(mockWriteContract).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------
// cancel
// -----------------------------------------------------------------------

describe('validation cancel', () => {
  it('errors without PRIVATE_KEY', async () => {
    const output = await collectOutput(['validation', 'cancel', '1', '--json'], {
      VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
      PRIVATE_KEY: undefined,
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('NO_PRIVATE_KEY');
  });

  it('errors on non-numeric requestId', async () => {
    const output = await collectOutput(['validation', 'cancel', 'abc', '--json'], {
      VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
      PRIVATE_KEY: FAKE_PRIVATE_KEY,
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_ERROR');
    expect(envelope.message).toContain('requestId must be a numeric value');
  });

  it('returns VALIDATION_NOT_FOUND when getValidationStatus reverts', async () => {
    mockReadContract.mockRejectedValue(makeContractRevertError('getValidationStatus'));

    const output = await collectOutput(['validation', 'cancel', '999', '--json'], {
      VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
      PRIVATE_KEY: FAKE_PRIVATE_KEY,
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_NOT_FOUND');
  });

  it('returns VALIDATION_NOT_PENDING when request is not Pending', async () => {
    // status=3 means Cancelled
    mockReadContract.mockResolvedValue([
      1n,
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      '0x00',
      3,
      '',
      1700000000n,
    ]);

    const output = await collectOutput(['validation', 'cancel', '1', '--json'], {
      VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
      PRIVATE_KEY: FAKE_PRIVATE_KEY,
    });

    const envelope = JSON.parse(output);
    expect(envelope.code).toBe('VALIDATION_NOT_PENDING');
    expect(envelope.message).toContain('Cancelled');
  });

  it('supports --dry-run simulation', async () => {
    mockReadContract.mockResolvedValue([
      1n,
      '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      '0x00',
      0, // Pending
      '',
      1700000000n,
    ]);

    mockSimulateContract.mockResolvedValue({ result: undefined } as never);

    const output = await collectOutput(['validation', 'cancel', '1', '--dry-run', '--json'], {
      VALIDATION_REGISTRY_ADDRESS: REGISTRY_ADDR,
      PRIVATE_KEY: FAKE_PRIVATE_KEY,
    });

    const envelope = JSON.parse(output);
    expect(envelope.dryRun).toBe(true);
    expect(envelope.simulationOk).toBe(true);
    expect(mockWriteContract).not.toHaveBeenCalled();
  });
});
