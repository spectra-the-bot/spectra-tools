import { describe, expect, it, vi } from 'vitest';
import { fetchHasSignedBatch } from '../services/forum.js';
import { fetchHasVotedBatch } from '../services/governance.js';

const ADDR = '0x230Ccc765765d729fFb1897D538f773b92005Aa2' as const;

function createMockClient(multicallFn: ReturnType<typeof vi.fn>) {
  return {
    readContract: vi.fn(),
    multicall: multicallFn,
    getBalance: vi.fn(),
    getBlock: vi.fn(),
    getBlockNumber: vi.fn(),
    getContractEvents: vi.fn(),
    estimateContractGas: vi.fn(),
    simulateContract: vi.fn(),
    waitForTransactionReceipt: vi.fn(),
  } as unknown as Parameters<typeof fetchHasVotedBatch>[0];
}

describe('fetchHasVotedBatch', () => {
  it('returns a Map<number, boolean> from a single multicall', async () => {
    const multicall = vi.fn().mockResolvedValueOnce([true, false, true]);
    const client = createMockClient(multicall);

    const result = await fetchHasVotedBatch(client, ADDR, [1, 2, 3]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(3);
    expect(result.get(1)).toBe(true);
    expect(result.get(2)).toBe(false);
    expect(result.get(3)).toBe(true);

    expect(multicall).toHaveBeenCalledTimes(1);
    const callArg = multicall.mock.calls[0][0];
    expect(callArg.allowFailure).toBe(false);
    expect(callArg.contracts).toHaveLength(3);
    expect(callArg.contracts[0]).toMatchObject({
      functionName: 'hasVoted',
      args: [1n, ADDR],
    });
    expect(callArg.contracts[2]).toMatchObject({
      functionName: 'hasVoted',
      args: [3n, ADDR],
    });
  });

  it('returns empty Map without RPC call for empty proposalIds', async () => {
    const multicall = vi.fn();
    const client = createMockClient(multicall);

    const result = await fetchHasVotedBatch(client, ADDR, []);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(multicall).not.toHaveBeenCalled();
  });
});

describe('fetchHasSignedBatch', () => {
  it('returns a Map<number, boolean> from a single multicall', async () => {
    const multicall = vi.fn().mockResolvedValueOnce([false, true]);
    const client = createMockClient(multicall);

    const result = await fetchHasSignedBatch(client, ADDR, [5, 10]);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.get(5)).toBe(false);
    expect(result.get(10)).toBe(true);

    expect(multicall).toHaveBeenCalledTimes(1);
    const callArg = multicall.mock.calls[0][0];
    expect(callArg.allowFailure).toBe(false);
    expect(callArg.contracts).toHaveLength(2);
    expect(callArg.contracts[0]).toMatchObject({
      functionName: 'hasSignedPetition',
      args: [5n, ADDR],
    });
    expect(callArg.contracts[1]).toMatchObject({
      functionName: 'hasSignedPetition',
      args: [10n, ADDR],
    });
  });

  it('returns empty Map without RPC call for empty petitionIds', async () => {
    const multicall = vi.fn();
    const client = createMockClient(multicall);

    const result = await fetchHasSignedBatch(client, ADDR, []);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(multicall).not.toHaveBeenCalled();
  });
});
