import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Envelope = {
  ok: boolean;
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

const mockClient = {
  readContract: vi.fn(),
  multicall: vi.fn(),
  getBalance: vi.fn(),
  getBlock: vi.fn(),
  getBlockNumber: vi.fn(),
  getContractEvents: vi.fn(),
};

vi.mock('../contracts/client.js', () => ({
  createAboreanPublicClient: () => mockClient,
}));

async function run(argv: string[]) {
  const { cli } = await import('../cli.js');
  const lines: string[] = [];
  await cli.serve([...argv, '--format', 'json', '--verbose'], {
    stdout: (line) => lines.push(line),
    exit: () => undefined,
  });
  const json = [...lines].reverse().find((x) => x.trim().startsWith('{')) ?? '{}';
  return JSON.parse(json) as Envelope;
}

function createViemError(options: { message: string; name: string; shortMessage: string }) {
  const error = new Error(options.message) as Error & { shortMessage?: string };
  error.name = options.name;
  error.shortMessage = options.shortMessage;
  return error;
}

describe('aborean CLI', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('status returns protocol snapshot', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(42n) // v2 allPoolsLength
      .mockResolvedValueOnce(15n) // CL allPoolsLength
      .mockResolvedValueOnce(30n) // voter length
      .mockResolvedValueOnce(1000000000000000000000n) // totalWeight
      .mockResolvedValueOnce(5000000000000000000000n) // veABX totalSupply
      .mockResolvedValueOnce(4000000000000000000000n); // veABX supply (locked)

    const out = await run(['status']);

    expect(out.ok).toBe(true);
    expect(mockClient.readContract).toHaveBeenCalledTimes(6);

    const data = out.data as Record<string, unknown>;
    expect(data.v2PoolCount).toBe(42);
    expect(data.clPoolCount).toBe(15);
    expect(data.gaugeCount).toBe(30);
    expect(data.totalVotingWeight).toBe('1000000000000000000000');
    expect(data.veABXTotalSupply).toBe('5000000000000000000000');
    expect(data.veABXLockedSupply).toBe('4000000000000000000000');
  });

  it('sanitizes RPC connection errors', async () => {
    mockClient.readContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'HTTP request failed.',
        message:
          'HTTP request failed.\n\nURL: https://api.mainnet.abs.xyz/\nRequest body: {"method":"eth_call"}\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['status']);

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('RPC_CONNECTION_FAILED');
    expect(out.error?.message).toContain('RPC connection failed');
    expect(out.error?.message).not.toContain('Version: viem@');
  });

  it('shows raw error details when --debug is passed', async () => {
    mockClient.readContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'HTTP request failed.',
        message: 'HTTP request failed.\n\nURL: https://api.mainnet.abs.xyz/\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['status', '--debug']);

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('UNKNOWN');
    expect(out.error?.message).toContain('Version: viem@2.47.0');
  });
});
