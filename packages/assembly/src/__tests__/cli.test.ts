import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Envelope = { ok: boolean; data?: unknown; error?: unknown };

const mockClient = {
  readContract: vi.fn(),
  multicall: vi.fn(),
  getBalance: vi.fn(),
};

vi.mock('../contracts/client.js', () => ({
  createAssemblyPublicClient: () => mockClient,
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

describe('assembly onchain commands', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('members count', async () => {
    mockClient.readContract.mockResolvedValueOnce(10n).mockResolvedValueOnce(20n);
    const out = await run(['members', 'count']);
    expect(out.ok).toBe(true);
    expect(mockClient.readContract).toHaveBeenCalledTimes(2);
  });

  it('members list returns structured error for invalid snapshot payload', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ members: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const out = await run(['members', 'list']);

    expect(out.ok).toBe(false);
    expect(JSON.stringify(out.error)).toContain('INVALID_ASSEMBLY_API_RESPONSE');
    expect(JSON.stringify(out.error)).toContain('Member snapshot response failed validation');
  });

  it('council is-member', async () => {
    mockClient.readContract.mockResolvedValueOnce(true);
    const out = await run(['council', 'is-member', '0x0000000000000000000000000000000000000000']);
    expect(out.ok).toBe(true);
  });

  it('forum stats', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(2n)
      .mockResolvedValueOnce(3n)
      .mockResolvedValueOnce(2500n);
    const out = await run(['forum', 'stats']);
    expect(out.ok).toBe(true);
  });

  it('governance params uses multicall', async () => {
    mockClient.multicall.mockResolvedValueOnce([1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n, 11n, 12n]);
    const out = await run(['governance', 'params']);
    expect(out.ok).toBe(true);
    expect(mockClient.multicall).toHaveBeenCalledTimes(1);
  });

  it('treasury balance', async () => {
    mockClient.getBalance.mockResolvedValueOnce(1000000000000000000n);
    const out = await run(['treasury', 'balance']);
    expect(out.ok).toBe(true);
  });

  it('status', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce(2n)
      .mockResolvedValueOnce(3n)
      .mockResolvedValueOnce(4n)
      .mockResolvedValueOnce(5n);
    mockClient.getBalance.mockResolvedValueOnce(100n);
    const out = await run(['status']);
    expect(out.ok).toBe(true);
  });
});
