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

const addrA = '0x00000000000000000000000000000000000000aa';
const addrB = '0x00000000000000000000000000000000000000bb';

describe('assembly onchain commands', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('members count', async () => {
    mockClient.readContract.mockResolvedValueOnce(10n).mockResolvedValueOnce(20n);
    const out = await run(['members', 'count']);
    expect(out.ok).toBe(true);
    expect(mockClient.readContract).toHaveBeenCalledTimes(2);
  });

  it('council is-member', async () => {
    mockClient.readContract.mockResolvedValueOnce(true);
    const out = await run(['council', 'is-member', '0x0000000000000000000000000000000000000000']);
    expect(out.ok).toBe(true);
  });

  it('council seats decodes tuple multicall responses', async () => {
    mockClient.readContract.mockResolvedValueOnce(2n);
    mockClient.multicall.mockResolvedValueOnce([
      [addrA, 100n, 200n, false],
      [addrB, 300n, 400n, true],
    ]);

    const out = await run(['council', 'seats']);
    expect(out.ok).toBe(true);

    const data = out.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(2);
    expect(data[0]).toMatchObject({ id: 0, startAt: 100, endAt: 200, forfeited: false });
    expect(data[1]).toMatchObject({ id: 1, startAt: 300, endAt: 400, forfeited: true });
  });

  it('council auction decodes tuple readContract response', async () => {
    mockClient.readContract.mockResolvedValueOnce([addrA, 123n, false]);

    const out = await run(['council', 'auction', '0', '0']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data.settled).toBe(false);
    expect(typeof data.highestBidder).toBe('string');
    expect(typeof data.highestBid).toBe('string');
  });

  it('forum thread decodes tuples and filters comments by thread id', async () => {
    mockClient.readContract
      .mockResolvedValueOnce([1n, 2n, addrA, 1700000000n, 'general', 'hello', 'world', 0n, 0n])
      .mockResolvedValueOnce(2n);
    mockClient.multicall.mockResolvedValueOnce([
      [1n, 1n, 0n, addrA, 1700000100n, 'first'],
      [2n, 2n, 0n, addrB, 1700000200n, 'second'],
    ]);

    const out = await run(['forum', 'thread', '1']);
    expect(out.ok).toBe(true);

    const data = out.data as {
      thread: Record<string, unknown>;
      comments: Array<Record<string, unknown>>;
    };
    expect(data.thread.id).toBe(1);
    expect(data.comments).toHaveLength(1);
    expect(data.comments[0]?.threadId).toBe(1);
  });

  it('forum petition decodes tuple and remains JSON-safe', async () => {
    mockClient.readContract
      .mockResolvedValueOnce([
        1n,
        addrA,
        1700000000n,
        'general',
        'title',
        'body',
        5n,
        false,
        7n,
        { kind: 1n },
      ])
      .mockResolvedValueOnce(true);

    const out = await run(['forum', 'petition', '1']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data.proposerSigned).toBe(true);
    expect(data.signatures).toBe(5);
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

  it('governance proposals decodes tuple multicall responses', async () => {
    mockClient.readContract.mockResolvedValueOnce(1n);
    mockClient.multicall.mockResolvedValueOnce([
      [
        1n,
        2n,
        3n,
        4n,
        addrA,
        11n,
        12n,
        100n,
        110n,
        120n,
        130n,
        140n,
        15n,
        16n,
        17n,
        18n,
        19n,
        20n,
        false,
        200n,
        1n,
        'Proposal title',
        'Proposal description',
      ],
    ]);

    const out = await run(['governance', 'proposals']);
    expect(out.ok).toBe(true);

    const data = out.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ id: 1, kind: 1, status: 4, voteEndAt: 130 });
  });

  it('governance proposal serializes bigint fields to JSON-safe values', async () => {
    mockClient.readContract.mockResolvedValueOnce([
      1n,
      2n,
      3n,
      4n,
      addrA,
      11n,
      12n,
      100n,
      110n,
      120n,
      130n,
      140n,
      15n,
      16n,
      17n,
      18n,
      19n,
      20n,
      false,
      200n,
      1n,
      'Proposal title',
      'Proposal description',
    ]);

    const out = await run(['governance', 'proposal', '1']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data.kind).toBe(1);
    expect(data.status).toBe(4);
    expect(data.forVotes).toBe('16');
    expect(data.amount).toBe('19');
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
