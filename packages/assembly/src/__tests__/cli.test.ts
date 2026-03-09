import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ABSTRACT_MAINNET_DEPLOYMENT_BLOCKS } from '../contracts/addresses.js';

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
  estimateContractGas: vi.fn().mockResolvedValue(21000n),
  simulateContract: vi.fn().mockResolvedValue({ result: undefined }),
  waitForTransactionReceipt: vi.fn(),
};

const mockWalletClient = {
  writeContract: vi.fn(),
};

// vi.mock is hoisted — cannot reference module-scope consts. Defaults set in beforeEach.
vi.mock('../contracts/client.js', () => ({
  createAssemblyPublicClient: () => mockClient,
  createAssemblyWalletClient: () => mockWalletClient,
  abstractMainnet: { id: 2741, name: 'Abstract Mainnet' },
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

async function runJson(argv: string[]) {
  const { cli } = await import('../cli.js');
  const lines: string[] = [];
  await cli.serve([...argv, '--format', 'json'], {
    stdout: (line) => lines.push(line),
    exit: () => undefined,
  });
  const json =
    [...lines].reverse().find((x) => {
      const trimmed = x.trim();
      return trimmed.startsWith('{') || trimmed.startsWith('[');
    }) ?? '{}';
  return JSON.parse(json) as Record<string, unknown>;
}

function createViemError(options: { message: string; name: string; shortMessage: string }) {
  const error = new Error(options.message) as Error & { shortMessage?: string };
  error.name = options.name;
  error.shortMessage = options.shortMessage;
  return error;
}

const MOCK_HASH =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;
const MOCK_FROM = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const addrA = '0x00000000000000000000000000000000000000aa';
const addrB = '0x00000000000000000000000000000000000000bb';

function iso(seconds: number): string {
  return new Date(seconds * 1000).toISOString().replace('.000Z', 'Z');
}

describe('assembly onchain commands', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    // Set defaults for write-related mocks (safe to set here, only consumed by write commands)
    mockWalletClient.writeContract.mockResolvedValue(MOCK_HASH);
    mockClient.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: MOCK_HASH,
      blockNumber: 42n,
      gasUsed: 21000n,
      status: 'success',
      from: MOCK_FROM,
      to: '0xc37cC38F4e463F50745Bdf9F306Ce6b4b6335717',
      effectiveGasPrice: 1000000000n,
      blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      contractAddress: null,
      cumulativeGasUsed: 21000n,
      logs: [],
      logsBloom: '0x',
      transactionIndex: 0,
      type: 'eip1559',
    });
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

  it('members list falls back to Registered events when indexer is unavailable', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', {
        status: 404,
        statusText: 'Not Found',
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    const latestBlock = ABSTRACT_MAINNET_DEPLOYMENT_BLOCKS.registry + 10n;
    mockClient.getBlockNumber.mockResolvedValueOnce(latestBlock);
    mockClient.getContractEvents.mockResolvedValueOnce([
      { args: { member: addrA } },
      { args: { member: addrB } },
      { args: { member: addrA } },
    ]);
    mockClient.multicall.mockResolvedValueOnce([
      true,
      { registered: true, activeUntil: 100n, lastHeartbeatAt: 90n },
      false,
      { registered: true, activeUntil: 80n, lastHeartbeatAt: 70n },
    ]);

    const out = await run(['members', 'list']);

    expect(out.ok).toBe(true);
    expect(mockClient.getContractEvents).toHaveBeenCalledTimes(1);
    expect(mockClient.getContractEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        fromBlock: ABSTRACT_MAINNET_DEPLOYMENT_BLOCKS.registry,
        toBlock: latestBlock,
      }),
    );
    const data = out.data as {
      members: Array<Record<string, unknown>>;
      count: number;
    };
    expect(data.count).toBe(2);
    expect(data.members).toHaveLength(2);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('"code":"ASSEMBLY_INDEXER_UNAVAILABLE"'),
    );
  });

  it('members list --format json returns stable members envelope without CTA keys', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([addrA]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.multicall.mockResolvedValueOnce([
      true,
      { registered: true, activeUntil: 100n, lastHeartbeatAt: 90n },
    ]);

    const out = await runJson(['members', 'list']);

    expect(Array.isArray(out.members)).toBe(true);
    expect(out.count).toBe(1);
    expect(out).not.toHaveProperty('0');
    expect(out).not.toHaveProperty('cta');

    const member = (out.members as Array<Record<string, unknown>>)[0];
    expect(member).toMatchObject({
      activeUntil: iso(100),
      activeUntilRelative: expect.any(String),
      lastHeartbeatAt: iso(90),
      lastHeartbeatRelative: expect.any(String),
    });
  });

  it('members list errors when indexer and fallback are unavailable', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', {
        status: 404,
        statusText: 'Not Found',
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.getBlockNumber.mockRejectedValueOnce(new Error('rpc unavailable'));

    const out = await run(['members', 'list']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'MEMBER_LIST_SOURCE_UNAVAILABLE' });
  });

  it('members list errors when fallback scan times out', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('', {
        status: 404,
        statusText: 'Not Found',
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation((callback) => {
      if (typeof callback === 'function') {
        callback();
      }
      return 0 as ReturnType<typeof setTimeout>;
    });

    mockClient.getBlockNumber.mockResolvedValueOnce(ABSTRACT_MAINNET_DEPLOYMENT_BLOCKS.registry);
    mockClient.getContractEvents.mockImplementationOnce(() => new Promise(() => undefined));

    const out = await run(['members', 'list']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'MEMBER_LIST_SOURCE_UNAVAILABLE' });
    expect(out.error?.message).toContain('timed out');
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('members info resolves a unique partial address match', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([addrA, addrB]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.readContract
      .mockResolvedValueOnce({ activeUntil: 100n, lastHeartbeatAt: 90n })
      .mockResolvedValueOnce(true);

    const out = await run(['members', 'info', '00bb']);

    expect(out.ok).toBe(true);
    expect(mockClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'members',
        args: [addrB],
      }),
    );
    expect(mockClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'isActive',
        args: [addrB],
      }),
    );
  });

  it('members info returns AMBIGUOUS_MEMBER_QUERY for non-unique partial matches', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([addrA, addrB]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const out = await run(['members', 'info', '00000000000000000000000000000000000000']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'AMBIGUOUS_MEMBER_QUERY' });
  });

  it('members info can match ENS/name metadata from member snapshot payload', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          { address: addrA, ens: 'alice.eth', name: 'Alice' },
          { address: addrB, ens: 'bob.eth', name: 'Bob' },
        ]),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.readContract
      .mockResolvedValueOnce({ activeUntil: 100n, lastHeartbeatAt: 90n })
      .mockResolvedValueOnce(true);

    const out = await run(['members', 'info', 'alice.eth']);

    expect(out.ok).toBe(true);
    expect(mockClient.readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'members',
        args: [addrA],
      }),
    );
  });

  it('members info returns MEMBER_NOT_FOUND when fuzzy lookup misses', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([addrA]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    const out = await run(['members', 'info', 'not-a-member']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'MEMBER_NOT_FOUND' });
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
    expect(data[0]).toMatchObject({
      id: 0,
      startAt: iso(100),
      endAt: iso(200),
      forfeited: false,
    });
    expect(data[1]).toMatchObject({
      id: 1,
      startAt: iso(300),
      endAt: iso(400),
      forfeited: true,
    });
  });

  it('council seat returns OUT_OF_RANGE when id >= seatCount', async () => {
    mockClient.readContract.mockResolvedValueOnce(2n);

    const out = await run(['council', 'seat', '2']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'OUT_OF_RANGE' });
    expect(out.error?.message).toContain('seatCount: 2');
    expect(mockClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('council auctions distinguishes open_now, upcoming, and closed_unsettled execution states', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(3n);
    mockClient.multicall
      .mockResolvedValueOnce([
        [addrA, 123n, false],
        [addrB, 456n, false],
        [addrA, 789n, false],
      ])
      .mockResolvedValueOnce([300n, 400n, 100n]);
    mockClient.getBlock.mockResolvedValueOnce({ timestamp: 150n });

    const out = await run(['council', 'auctions']);
    expect(out.ok).toBe(true);

    const data = out.data as { auctions: Array<Record<string, unknown>> };
    expect(data.auctions).toHaveLength(3);
    expect(data.auctions[0]).toMatchObject({
      windowEnd: iso(300),
      executionStatus: 'open_now',
      status: 'open_now',
      bidExecutableNow: true,
      settled: false,
    });
    expect(data.auctions[1]).toMatchObject({
      windowEnd: iso(400),
      executionStatus: 'upcoming',
      status: 'upcoming',
      bidExecutableNow: false,
      settled: false,
    });
    expect(data.auctions[2]).toMatchObject({
      windowEnd: iso(100),
      executionStatus: 'closed_unsettled',
      status: 'closed_unsettled',
      bidExecutableNow: false,
      settled: false,
    });
    expect(data.auctions.filter((auction) => auction.bidExecutableNow === true)).toHaveLength(1);
    expect(typeof data.auctions[0]?.windowEndRelative).toBe('string');
  });

  it('council auctions --format json keeps auction data under auctions key without CTA', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(1n);
    mockClient.multicall
      .mockResolvedValueOnce([[addrA, 123n, false]])
      .mockResolvedValueOnce([200n]);
    mockClient.getBlock.mockResolvedValueOnce({ timestamp: 150n });

    const out = await runJson(['council', 'auctions']);

    expect(Array.isArray(out.auctions)).toBe(true);
    expect(out.count).toBeUndefined();
    expect(out).not.toHaveProperty('0');
    expect(out).not.toHaveProperty('cta');
  });

  it('council auction includes executionStatus and bidExecutableNow fields', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(4n) // AUCTION_SLOTS_PER_DAY
      .mockResolvedValueOnce([addrA, 123n, true])
      .mockResolvedValueOnce(999n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);
    mockClient.getBlock.mockResolvedValueOnce({ timestamp: 150n });

    const out = await run(['council', 'auction', '0', '0']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data).toMatchObject({
      settled: true,
      windowEnd: iso(999),
      executionStatus: 'settled',
      status: 'settled',
      bidExecutableNow: false,
    });
    expect(typeof data.highestBidder).toBe('string');
    expect(typeof data.highestBid).toBe('string');
    expect(typeof data.windowEndRelative).toBe('string');
  });

  it('council auction returns OUT_OF_RANGE when slot >= AUCTION_SLOTS_PER_DAY', async () => {
    mockClient.readContract.mockResolvedValueOnce(4n); // AUCTION_SLOTS_PER_DAY

    const out = await run(['council', 'auction', '2', '5']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'OUT_OF_RANGE' });
    expect(out.error?.message).toContain('max: 3');
    expect(mockClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('forum threads wraps array results in an object when CTA metadata is present', async () => {
    mockClient.readContract.mockResolvedValueOnce(1n);
    mockClient.multicall.mockResolvedValueOnce([
      [1n, 2n, addrA, 1700000000n, 'general', 'hello', 'world', 0n, 0n],
    ]);

    const out = await run(['forum', 'threads']);
    expect(out.ok).toBe(true);

    const data = out.data as {
      threads: Array<Record<string, unknown>>;
      count: number;
    };
    expect(data.count).toBe(1);
    expect(data.threads).toHaveLength(1);
    expect(data.threads[0]).toMatchObject({
      id: 1,
      kind: 2,
      author: '0x00000000000000000000000000000000000000AA',
      createdAt: iso(1700000000),
      createdAtRelative: expect.any(String),
    });
  });

  it('forum threads --format json keeps thread data under a threads array key', async () => {
    mockClient.readContract.mockResolvedValueOnce(1n);
    mockClient.multicall.mockResolvedValueOnce([
      [1n, 2n, addrA, 1700000000n, 'general', 'hello', 'world', 0n, 0n],
    ]);

    const out = await runJson(['forum', 'threads']);

    expect(Array.isArray(out.threads)).toBe(true);
    expect(out).not.toHaveProperty('0');
    expect(out).not.toHaveProperty('cta');
    expect(out.count).toBe(1);
  });

  it('forum thread decodes tuples and filters comments by thread id', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(2n)
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

  it('forum thread returns OUT_OF_RANGE when id > threadCount', async () => {
    mockClient.readContract.mockResolvedValueOnce(1n);

    const out = await run(['forum', 'thread', '2']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'OUT_OF_RANGE' });
    expect(out.error?.message).toContain('threadCount: 1');
    expect(mockClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('forum comment returns OUT_OF_RANGE when id > commentCount', async () => {
    mockClient.readContract.mockResolvedValueOnce(1n);

    const out = await run(['forum', 'comment', '2']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'OUT_OF_RANGE' });
    expect(out.error?.message).toContain('commentCount: 1');
    expect(mockClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('forum petition decodes tuple and remains JSON-safe', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(1n)
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

  it('forum petition returns OUT_OF_RANGE when id > petitionCount', async () => {
    mockClient.readContract.mockResolvedValueOnce(1n);

    const out = await run(['forum', 'petition', '2']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'OUT_OF_RANGE' });
    expect(out.error?.message).toContain('petitionCount: 1');
    expect(mockClient.readContract).toHaveBeenCalledTimes(1);
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

    const data = out.data as {
      proposals: Array<Record<string, unknown>>;
      count: number;
    };
    expect(data.count).toBe(1);
    expect(data.proposals).toHaveLength(1);
    expect(data.proposals[0]).toMatchObject({
      id: 1,
      kind: 1,
      status: 'defeated',
      statusCode: 4,
      voteEndAt: iso(130),
    });
  });

  it('governance proposals --format json keeps proposal data under a proposals array key', async () => {
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

    const out = await runJson(['governance', 'proposals']);

    expect(Array.isArray(out.proposals)).toBe(true);
    expect(out).not.toHaveProperty('0');
    expect(out).not.toHaveProperty('cta');
    expect(out.count).toBe(1);
  });

  it('governance proposal serializes bigint fields to JSON-safe values', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(1n)
      .mockResolvedValueOnce([
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
    expect(data.status).toBe('defeated');
    expect(data.statusCode).toBe(4);
    expect(data.forVotes).toBe('16');
    expect(data.amount).toBe('19');
  });

  it('governance proposal returns OUT_OF_RANGE when id > proposalCount', async () => {
    mockClient.readContract.mockResolvedValueOnce(1n);

    const out = await run(['governance', 'proposal', '2']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'OUT_OF_RANGE' });
    expect(out.error?.message).toContain('proposalCount: 1');
    expect(mockClient.readContract).toHaveBeenCalledTimes(1);
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

  it('treasury major-spend-status returns ISO timestamp plus relative label in JSON', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(3600n)
      .mockResolvedValueOnce(123n)
      .mockResolvedValueOnce(true);

    const out = await run(['treasury', 'major-spend-status']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data).toMatchObject({
      majorSpendCooldownSeconds: 3600,
      lastMajorSpendAt: iso(123),
      lastMajorSpendRelative: expect.any(String),
      isMajorSpendAllowed: true,
    });
  });

  it('treasury executed returns OUT_OF_RANGE when proposalId > proposalCount', async () => {
    mockClient.readContract.mockResolvedValueOnce(1n);

    const out = await run(['treasury', 'executed', '2']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'OUT_OF_RANGE' });
    expect(out.error?.message).toContain('proposalCount: 1');
    expect(mockClient.readContract).toHaveBeenCalledTimes(1);
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

  it('sanitizes invalid address viem internals by default', async () => {
    mockClient.readContract.mockRejectedValueOnce(
      createViemError({
        name: 'InvalidAddressError',
        shortMessage: 'Address "0xinvalid" is invalid.',
        message:
          'Address "0xinvalid" is invalid.\n\n- Address must be a hex value of 20 bytes (40 hex characters).\n\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['health', '0xinvalid']);

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_ADDRESS');
    expect(out.error?.message).toContain('Address "0xinvalid" is invalid.');
    expect(out.error?.message).toContain('Use a valid 0x-prefixed 20-byte address.');
    expect(out.error?.message).not.toContain('Version: viem@');
  });

  it('returns actionable RPC failure message without leaking request internals', async () => {
    mockClient.readContract.mockRejectedValueOnce(
      createViemError({
        name: 'ContractFunctionExecutionError',
        shortMessage: 'HTTP request failed.',
        message:
          'HTTP request failed.\n\nURL: https://fake-rpc.example.com/\nRequest body: {"method":"eth_call"}\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['status']);

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('RPC_CONNECTION_FAILED');
    expect(out.error?.message).toContain(
      'RPC connection failed. Check ABSTRACT_RPC_URL and try again.',
    );
    expect(out.error?.message).not.toContain('URL: https://fake-rpc.example.com/');
    expect(out.error?.message).not.toContain('Request body:');
  });

  it('shows help guidance for missing required args', async () => {
    const out = await run(['treasury', 'whitelist']);

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('VALIDATION_ERROR');
    expect(out.error?.message).toContain('Missing required argument: asset.');
    expect(out.error?.message).toContain('assembly treasury whitelist --help');
    expect(out.error?.message).not.toContain('Invalid input: expected string, received undefined');
  });

  it('keeps raw upstream errors when --debug is enabled', async () => {
    mockClient.readContract.mockRejectedValueOnce(
      createViemError({
        name: 'InvalidAddressError',
        shortMessage: 'Address "0xinvalid" is invalid.',
        message:
          'Address "0xinvalid" is invalid.\n\n- Address must be a hex value of 20 bytes (40 hex characters).\n\nVersion: viem@2.47.0',
      }),
    );

    const out = await run(['health', '0xinvalid', '--debug']);

    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('UNKNOWN');
    expect(out.error?.message).toContain('Version: viem@2.47.0');
  });
});

// ---------------------------------------------------------------------------
// council write commands
// ---------------------------------------------------------------------------
describe('council write commands', () => {
  const TEST_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.PRIVATE_KEY = TEST_PK;
    mockClient.estimateContractGas.mockResolvedValue(21000n);
    mockClient.simulateContract.mockResolvedValue({ result: undefined });
    mockWalletClient.writeContract.mockResolvedValue(MOCK_HASH);
    mockClient.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: MOCK_HASH,
      blockNumber: 42n,
      gasUsed: 21000n,
      status: 'success',
      from: MOCK_FROM,
      to: '0xc37cC38F4e463F50745Bdf9F306Ce6b4b6335717',
      effectiveGasPrice: 1000000000n,
      blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      contractAddress: null,
      cumulativeGasUsed: 21000n,
      logs: [],
      logsBloom: '0x',
      transactionIndex: 0,
      type: 'eip1559',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.PRIVATE_KEY = undefined;
  });

  async function runWrite(argv: string[]) {
    const { cli } = await import('../cli.js');
    const lines: string[] = [];
    await cli.serve([...argv, '--format', 'json', '--verbose'], {
      stdout: (line) => lines.push(line),
      exit: () => undefined,
    });
    const json = [...lines].reverse().find((x) => x.trim().startsWith('{')) ?? '{}';
    return JSON.parse(json) as Envelope;
  }

  describe('council bid', () => {
    it('places a bid on the open_now auction slot', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 50000000000000000n, false]);
      mockClient.readContract.mockResolvedValueOnce(9999999999n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 100n });

      const out = await runWrite(['council', 'bid', '0', '0', '--amount', '0.1']);

      expect(out.ok).toBe(true);
      const data = out.data as Record<string, unknown>;
      expect(data.day).toBe(0);
      expect(data.slot).toBe(0);
      expect(data.bidAmount).toBe('0.1 ETH');
      const tx = data.tx as Record<string, unknown>;
      expect(tx.status).toBe('success');
      expect(tx.hash).toBe(MOCK_HASH);
    });

    it('rejects bid on settled auction', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 100n, true]);
      mockClient.readContract.mockResolvedValueOnce(200n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 300n });

      const out = await runWrite(['council', 'bid', '0', '0', '--amount', '0.1']);

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('AUCTION_SETTLED');
    });

    it('rejects bid on closed auction', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 100n, false]);
      mockClient.readContract.mockResolvedValueOnce(200n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 300n });

      const out = await runWrite(['council', 'bid', '0', '0', '--amount', '0.1']);

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('AUCTION_CLOSED');
    });

    it('rejects bid on upcoming auction slot', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 100n, false]);
      mockClient.readContract.mockResolvedValueOnce(9999999999n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 100n });

      const out = await runWrite(['council', 'bid', '0', '1', '--amount', '0.1']);

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('AUCTION_NOT_ACTIVE');
    });

    it('rejects bid lower than current highest', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 1000000000000000000n, false]);
      mockClient.readContract.mockResolvedValueOnce(9999999999n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 100n });

      const out = await runWrite(['council', 'bid', '0', '0', '--amount', '0.5']);

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('BID_TOO_LOW');
    });

    it('returns dry-run result without broadcasting', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 50000000000000000n, false]);
      mockClient.readContract.mockResolvedValueOnce(9999999999n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 100n });

      const out = await runWrite(['council', 'bid', '0', '0', '--amount', '0.1', '--dry-run']);

      expect(out.ok).toBe(true);
      const data = out.data as Record<string, unknown>;
      const tx = data.tx as Record<string, unknown>;
      expect(tx.status).toBe('dry-run');
      expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
    });

    it('rejects slot out of range', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);

      const out = await runWrite(['council', 'bid', '0', '5', '--amount', '0.1']);

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('OUT_OF_RANGE');
    });
  });

  describe('council settle', () => {
    it('settles a closed auction', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 100000000000000000n, false]);
      mockClient.readContract.mockResolvedValueOnce(200n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 300n });

      const out = await runWrite(['council', 'settle', '0', '0']);

      expect(out.ok).toBe(true);
      const data = out.data as Record<string, unknown>;
      expect(data.day).toBe(0);
      expect(data.slot).toBe(0);
      const tx = data.tx as Record<string, unknown>;
      expect(tx.status).toBe('success');
    });

    it('rejects already settled auction', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 100n, true]);
      mockClient.readContract.mockResolvedValueOnce(200n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 300n });

      const out = await runWrite(['council', 'settle', '0', '0']);

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('ALREADY_SETTLED');
    });

    it('rejects auction still accepting bids', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 100n, false]);
      mockClient.readContract.mockResolvedValueOnce(9999999999n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 100n });

      const out = await runWrite(['council', 'settle', '0', '0']);

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('AUCTION_STILL_ACTIVE');
    });

    it('rejects settling an upcoming auction slot', async () => {
      mockClient.readContract.mockResolvedValueOnce(4n);
      mockClient.readContract.mockResolvedValueOnce([addrA, 100n, false]);
      mockClient.readContract.mockResolvedValueOnce(9999999999n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.readContract.mockResolvedValueOnce(0n);
      mockClient.getBlock.mockResolvedValueOnce({ timestamp: 100n });

      const out = await runWrite(['council', 'settle', '0', '1']);

      expect(out.ok).toBe(false);
      expect(out.error?.code).toBe('AUCTION_STILL_ACTIVE');
    });
  });

  describe('council withdraw-refund', () => {
    it('withdraws pending refund when balance > 0', async () => {
      mockClient.readContract.mockResolvedValueOnce(500000000000000000n);

      const out = await runWrite(['council', 'withdraw-refund']);

      expect(out.ok).toBe(true);
      const data = out.data as Record<string, unknown>;
      expect(data.refundAmount).toBe('0.5 ETH');
      expect(data.refundAmountWei).toBe('500000000000000000');
      const tx = data.tx as Record<string, unknown>;
      expect(tx.status).toBe('success');
    });

    it('returns gracefully when no refund available', async () => {
      mockClient.readContract.mockResolvedValueOnce(0n);

      const out = await runWrite(['council', 'withdraw-refund']);

      expect(out.ok).toBe(true);
      const data = out.data as Record<string, unknown>;
      expect(data.refundAmount).toBe('0 ETH');
      expect(data.refundAmountWei).toBe('0');
      expect(data.tx).toBeUndefined();
      expect(mockWalletClient.writeContract).not.toHaveBeenCalled();
    });
  });
});
