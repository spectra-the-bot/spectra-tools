import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type ErrorOutput = {
  code?: string;
  message?: string;
};

const mockReadContract = vi.fn();
const mockWriteContract = vi.fn();
const mockClient = {
  multicall: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
};

vi.mock('viem/actions', () => ({
  readContract: mockReadContract,
  writeContract: mockWriteContract,
}));

vi.mock('../contracts/client.js', () => ({
  MULTICALL_BATCH_SIZE: 50,
  abstractMainnet: { id: 2741 },
  getPublicClient: () => mockClient,
  getWalletClient: vi.fn(),
  getReputationRegistryAddress: () => '0x1234567890123456789012345678901234567890',
  getValidationRegistryAddress: () => '0x1234567890123456789012345678901234567890',
}));

vi.mock('@spectratools/cli-shared', async () => {
  const actual = await vi.importActual<typeof import('@spectratools/cli-shared')>(
    '@spectratools/cli-shared',
  );
  return {
    ...actual,
    withRetry: async <T>(fn: () => Promise<T>) => fn(),
  };
});

function createViemError(options: { message: string; name: string; shortMessage: string }): Error {
  const error = new Error(options.message);
  error.name = options.name;
  (error as Error & { shortMessage: string }).shortMessage = options.shortMessage;
  return error;
}

async function run(argv: string[]): Promise<ErrorOutput> {
  const { cli } = await import('../cli.js');
  let output = '';
  await cli.serve([...argv, '--json'], {
    stdout: (line) => {
      output += line;
    },
    exit: () => undefined,
  });
  return JSON.parse(output) as ErrorOutput;
}

describe('erc8004 revert error mapping', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockClient.multicall.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps reputation get revert to AGENT_NOT_FOUND', async () => {
    mockReadContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'Contract function "getScore" reverts',
        message: 'Contract function "getScore" reverts\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['reputation', 'get', '634']);

    expect(mockReadContract).toHaveBeenCalled();
    expect(out.code).toBe('AGENT_NOT_FOUND');
    expect(out.message).toContain('No reputation data found');
  });

  it('maps reputation history revert to AGENT_NOT_FOUND', async () => {
    mockReadContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'Contract function "getFeedbackCount" reverts',
        message: 'Contract function "getFeedbackCount" reverts\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['reputation', 'history', '634']);

    expect(out.code).toBe('AGENT_NOT_FOUND');
  });

  it('maps validation status revert to VALIDATION_NOT_FOUND', async () => {
    mockReadContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'Contract function "getValidationStatus" reverts',
        message: 'Contract function "getValidationStatus" reverts\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['validation', 'status', '634']);

    expect(out.code).toBe('VALIDATION_NOT_FOUND');
  });

  it('maps validation history revert to AGENT_NOT_FOUND', async () => {
    mockReadContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'The contract function "getValidationCount" returned no data ("0x")',
        message:
          'The contract function "getValidationCount" returned no data ("0x")\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['validation', 'history', '634']);

    expect(out.code).toBe('AGENT_NOT_FOUND');
  });

  it('maps unknown reputation revert for getScore to AGENT_NOT_FOUND', async () => {
    mockReadContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'Execution reverted for unknown reason',
        message: 'Execution reverted for unknown reason\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['reputation', 'get', '634']);

    expect(out.code).toBe('AGENT_NOT_FOUND');
  });
});
