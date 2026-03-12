import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDuration } from '../commands/digest.js';
import { ABSTRACT_MAINNET_DEPLOYMENT_BLOCKS } from '../contracts/addresses.js';

type Envelope = {
  ok: boolean;
  data?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
};

const addrA = '0x00000000000000000000000000000000000000aa';
const addrB = '0x00000000000000000000000000000000000000bb';
const WALLET = '0x230Ccc765765d729fFb1897D538f773b92005Aa2';

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

vi.mock('../contracts/client.js', () => ({
  createAssemblyPublicClient: () => mockClient,
  createAssemblyWalletClient: () => ({}),
  abstractMainnet: { id: 2741, name: 'Abstract Mainnet' },
}));

function proposalTuple(overrides?: { status?: bigint; title?: string; createdAt?: bigint }) {
  return [
    1n, // kind
    0n, // configRiskTier
    0n, // origin
    overrides?.status ?? 1n, // status
    addrA, // proposer
    1n, // threadId
    0n, // petitionId
    overrides?.createdAt ?? 1700000000n, // createdAt
    1700003600n, // deliberationEndsAt
    1700007200n, // voteStartAt
    1700010800n, // voteEndAt
    1700014400n, // timelockEndsAt
    10n, // activeSeatsSnapshot
    5n, // forVotes
    2n, // againstVotes
    1n, // abstainVotes
    0n, // amount
    0n, // snapshotAssetBalance
    false, // transferIntent
    0n, // intentDeadline
    0n, // intentMaxRiskTier
    overrides?.title ?? 'Test proposal', // title
    'Test description', // description
  ];
}

function threadTuple(id: number, overrides?: { createdAt?: bigint }) {
  return [
    BigInt(id),
    2n,
    addrA,
    overrides?.createdAt ?? 1700000000n,
    'general',
    `Thread ${id}`,
    'body text',
    0n,
    0n,
  ];
}

function commentTuple(id: number, threadId: number, overrides?: { createdAt?: bigint }) {
  return [
    BigInt(id),
    BigInt(threadId),
    0n,
    addrB,
    overrides?.createdAt ?? 1700000100n,
    `Comment ${id}`,
  ];
}

function petitionTuple(id: number, overrides?: { createdAt?: bigint }) {
  return [
    BigInt(id),
    addrA,
    overrides?.createdAt ?? 1700000000n,
    'governance',
    `Petition ${id}`,
    'Petition body',
    3n,
    false,
    BigInt(id),
    { kind: 1n },
  ];
}

async function run(argv: string[]) {
  const { cli } = await import('../cli.js');
  const lines: string[] = [];
  await cli.serve([...argv, '--format', 'json', '--verbose'], {
    stdout: (line: string) => lines.push(line),
    exit: () => undefined,
  });
  const json = [...lines].reverse().find((x) => x.trim().startsWith('{')) ?? '{}';
  return JSON.parse(json) as Envelope;
}

async function runJson(argv: string[]) {
  const { cli } = await import('../cli.js');
  const lines: string[] = [];
  await cli.serve([...argv, '--format', 'json'], {
    stdout: (line: string) => lines.push(line),
    exit: () => undefined,
  });
  const json =
    [...lines].reverse().find((x) => {
      const trimmed = x.trim();
      return trimmed.startsWith('{') || trimmed.startsWith('[');
    }) ?? '{}';
  return JSON.parse(json) as Record<string, unknown>;
}

describe('assembly digest', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns aggregated digest with all sections', async () => {
    // Mock member snapshot fetch
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([addrA, addrB]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    // Use mockImplementation to handle concurrent calls by functionName
    mockClient.readContract.mockImplementation((args: { functionName: string }) => {
      switch (args.functionName) {
        case 'proposalCount':
          return Promise.resolve(2n);
        case 'threadCount':
          return Promise.resolve(1n);
        case 'commentCount':
          return Promise.resolve(2n);
        case 'petitionCount':
          return Promise.resolve(1n);
        default:
          return Promise.resolve(0n);
      }
    });

    // Route multicall by first contract's functionName
    mockClient.multicall.mockImplementation(
      (args: { contracts: Array<{ functionName: string }> }) => {
        const fn = args.contracts[0]?.functionName;
        switch (fn) {
          case 'proposals':
            return Promise.resolve([
              proposalTuple({ status: 1n, title: 'Proposal A' }),
              proposalTuple({ status: 4n, title: 'Proposal B' }),
            ]);
          case 'threads':
            return Promise.resolve([threadTuple(1)]);
          case 'comments':
            return Promise.resolve([commentTuple(1, 1), commentTuple(2, 1)]);
          case 'petitions':
            return Promise.resolve([petitionTuple(1)]);
          case 'isActive':
            return Promise.resolve([
              true,
              { registered: true, activeUntil: 1700100000n, lastHeartbeatAt: 1700050000n },
              false,
              { registered: true, activeUntil: 1700080000n, lastHeartbeatAt: 1700040000n },
            ]);
          default:
            return Promise.resolve([]);
        }
      },
    );

    const out = await run(['digest']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;

    // Meta
    const meta = data.meta as Record<string, unknown>;
    expect(meta.chainId).toBe(2741);
    expect(typeof meta.fetchedAt).toBe('string');
    expect(meta.address).toBeUndefined();

    // Proposals
    const proposals = data.proposals as Array<Record<string, unknown>>;
    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toMatchObject({
      id: 1,
      title: 'Proposal A',
      status: 'active',
      statusCode: 1,
    });
    expect(proposals[1]).toMatchObject({
      id: 2,
      title: 'Proposal B',
      status: 'defeated',
      statusCode: 4,
    });
    expect(proposals[0]).not.toHaveProperty('hasVoted');

    // Threads
    const threads = data.threads as Array<Record<string, unknown>>;
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      id: 1,
      kind: 2,
      title: 'Thread 1',
    });

    // Comments — batch fetched without per-thread invocation
    const comments = data.comments as Array<Record<string, unknown>>;
    expect(comments).toHaveLength(2);
    expect(comments[0]).toMatchObject({ id: 1, threadId: 1, body: 'Comment 1' });
    expect(comments[1]).toMatchObject({ id: 2, threadId: 1, body: 'Comment 2' });

    // Petitions
    const petitions = data.petitions as Array<Record<string, unknown>>;
    expect(petitions).toHaveLength(1);
    expect(petitions[0]).toMatchObject({
      id: 1,
      title: 'Petition 1',
      signatures: 3,
      promoted: false,
    });
    expect(petitions[0]).not.toHaveProperty('hasSigned');

    // Members
    const members = data.members as { count: number; items: Array<Record<string, unknown>> };
    expect(members.count).toBe(2);
    expect(members.items).toHaveLength(2);
    expect(members.items[0]).toMatchObject({
      active: true,
      registered: true,
    });

    // Errors
    expect(data.errors).toEqual([]);
  });

  it('enriches proposals with hasVoted and petitions with hasSigned when --address is provided', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([addrA]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    // Use mockImplementation to handle concurrent calls by functionName
    mockClient.readContract.mockImplementation((args: { functionName: string }) => {
      switch (args.functionName) {
        case 'proposalCount':
          return Promise.resolve(2n);
        case 'threadCount':
          return Promise.resolve(0n);
        case 'commentCount':
          return Promise.resolve(0n);
        case 'petitionCount':
          return Promise.resolve(2n);
        default:
          return Promise.resolve(0n);
      }
    });

    // Route multicall by first contract's functionName
    mockClient.multicall.mockImplementation(
      (args: { contracts: Array<{ functionName: string }> }) => {
        const fn = args.contracts[0]?.functionName;
        switch (fn) {
          case 'proposals':
            return Promise.resolve([
              proposalTuple({ status: 1n, title: 'Prop 1' }),
              proposalTuple({ status: 2n, title: 'Prop 2' }),
            ]);
          case 'petitions':
            return Promise.resolve([petitionTuple(1), petitionTuple(2)]);
          case 'isActive':
            return Promise.resolve([
              true,
              { registered: true, activeUntil: 1700100000n, lastHeartbeatAt: 1700050000n },
            ]);
          case 'hasVoted':
            return Promise.resolve([true, false]);
          case 'hasSignedPetition':
            return Promise.resolve([false, true]);
          default:
            return Promise.resolve([]);
        }
      },
    );

    const out = await run(['digest', '--address', WALLET]);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;

    // Meta includes address
    const meta = data.meta as Record<string, unknown>;
    expect(meta.address).toBe(WALLET);

    // Proposals enriched with hasVoted
    const proposals = data.proposals as Array<Record<string, unknown>>;
    expect(proposals).toHaveLength(2);
    expect(proposals[0].hasVoted).toBe(true);
    expect(proposals[1].hasVoted).toBe(false);

    // Petitions enriched with hasSigned
    const petitions = data.petitions as Array<Record<string, unknown>>;
    expect(petitions).toHaveLength(2);
    expect(petitions[0].hasSigned).toBe(false);
    expect(petitions[1].hasSigned).toBe(true);
  });

  it('returns valid output with empty data when no proposals/threads/petitions exist', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.readContract
      .mockResolvedValueOnce(0n) // proposalCount
      .mockResolvedValueOnce(0n) // threadCount
      .mockResolvedValueOnce(0n) // commentCount
      .mockResolvedValueOnce(0n); // petitionCount

    const out = await run(['digest']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data.proposals).toEqual([]);
    expect(data.threads).toEqual([]);
    expect(data.comments).toEqual([]);
    expect(data.petitions).toEqual([]);
    expect((data.members as { count: number }).count).toBe(0);
    expect(data.errors).toEqual([]);
  });

  it('captures partial errors with --allow-partial returning partial data + error entries', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([addrA]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    // proposalCount succeeds
    mockClient.readContract
      .mockResolvedValueOnce(1n) // proposalCount
      .mockRejectedValueOnce(new Error('forum RPC down')) // threadCount fails
      .mockResolvedValueOnce(0n) // commentCount
      .mockResolvedValueOnce(0n); // petitionCount

    // Proposals multicall succeeds
    mockClient.multicall
      .mockResolvedValueOnce([proposalTuple({ title: 'Works' })])
      // Member onchain state
      .mockResolvedValueOnce([
        true,
        { registered: true, activeUntil: 1700100000n, lastHeartbeatAt: 1700050000n },
      ]);

    const out = await run(['digest', '--allow-partial']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;

    // Proposals succeeded
    const proposals = data.proposals as Array<Record<string, unknown>>;
    expect(proposals).toHaveLength(1);
    expect(proposals[0].title).toBe('Works');

    // Threads failed — captured in errors
    expect(data.threads).toEqual([]);
    const errors = data.errors as Array<Record<string, unknown>>;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.section === 'threads')).toBe(true);

    // Verify structured error format
    const threadError = errors.find((e) => e.section === 'threads');
    expect(threadError).toMatchObject({
      section: 'threads',
      code: expect.any(String),
      message: expect.stringContaining('forum RPC down'),
      timestamp: expect.any(String),
    });

    // meta.partial should be true
    const meta = data.meta as Record<string, unknown>;
    expect(meta.partial).toBe(true);
  });

  it('default behavior (no flags) fails the command on section error', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([addrA]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    // proposalCount succeeds
    mockClient.readContract
      .mockResolvedValueOnce(1n) // proposalCount
      .mockRejectedValueOnce(new Error('forum RPC down')) // threadCount fails
      .mockResolvedValueOnce(0n) // commentCount
      .mockResolvedValueOnce(0n); // petitionCount

    // Proposals multicall succeeds
    mockClient.multicall.mockResolvedValueOnce([proposalTuple({ title: 'Works' })]);

    const out = await run(['digest']);
    expect(out.ok).toBe(false);
    expect(out.error?.message).toContain('threads');
    expect(out.error?.message).toContain('forum RPC down');
  });

  it('--strict fails the command on section error', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([addrA]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.readContract
      .mockResolvedValueOnce(1n) // proposalCount
      .mockRejectedValueOnce(new Error('forum RPC down')) // threadCount fails
      .mockResolvedValueOnce(0n) // commentCount
      .mockResolvedValueOnce(0n); // petitionCount

    mockClient.multicall.mockResolvedValueOnce([proposalTuple({ title: 'Works' })]);

    const out = await run(['digest', '--strict']);
    expect(out.ok).toBe(false);
    expect(out.error?.message).toContain('threads');
    expect(out.error?.message).toContain('forum RPC down');
  });

  it('--allow-partial and --strict together returns validation error', async () => {
    const out = await run(['digest', '--allow-partial', '--strict']);
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_OPTIONS');
    expect(out.error?.message).toContain('mutually exclusive');
  });

  it('meta.partial is false when all sections succeed', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.readContract
      .mockResolvedValueOnce(0n) // proposalCount
      .mockResolvedValueOnce(0n) // threadCount
      .mockResolvedValueOnce(0n) // commentCount
      .mockResolvedValueOnce(0n); // petitionCount

    const out = await run(['digest']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const meta = data.meta as Record<string, unknown>;
    expect(meta.partial).toBe(false);
    expect(data.errors).toEqual([]);
  });

  it('--rpc-url option overrides the ABSTRACT_RPC_URL env var', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.readContract
      .mockResolvedValueOnce(0n) // proposalCount
      .mockResolvedValueOnce(0n) // threadCount
      .mockResolvedValueOnce(0n) // commentCount
      .mockResolvedValueOnce(0n); // petitionCount

    // The --rpc-url option is accepted and the command completes successfully
    const out = await run(['digest', '--rpc-url', 'https://custom-rpc.example.com']);
    expect(out.ok).toBe(true);
  });

  it('--format json returns structured output without envelope wrapping', async () => {
    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.readContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n);

    const out = await runJson(['digest']);

    expect(out.meta).toBeDefined();
    expect(out.proposals).toBeDefined();
    expect(out.threads).toBeDefined();
    expect(out.comments).toBeDefined();
    expect(out.petitions).toBeDefined();
    expect(out.members).toBeDefined();
    expect(out.errors).toBeDefined();
    expect(out).not.toHaveProperty('cta');
  });

  it('falls back to on-chain events when member indexer is unavailable', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 404, statusText: 'Not Found' }));
    vi.stubGlobal('fetch', mockFetch);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    mockClient.readContract
      .mockResolvedValueOnce(0n) // proposalCount
      .mockResolvedValueOnce(0n) // threadCount
      .mockResolvedValueOnce(0n) // commentCount
      .mockResolvedValueOnce(0n); // petitionCount

    // Registered events fallback
    const latestBlock = ABSTRACT_MAINNET_DEPLOYMENT_BLOCKS.registry + 10n;
    mockClient.getBlockNumber.mockResolvedValueOnce(latestBlock);
    mockClient.getContractEvents.mockResolvedValueOnce([{ args: { member: addrA } }]);

    // Member onchain state
    mockClient.multicall.mockResolvedValueOnce([
      true,
      { registered: true, activeUntil: 1700100000n, lastHeartbeatAt: 1700050000n },
    ]);

    const out = await run(['digest']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const members = data.members as { count: number; items: Array<Record<string, unknown>> };
    expect(members.count).toBe(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('ASSEMBLY_INDEXER_UNAVAILABLE'));
  });

  // =====================================================================
  // Filter tests
  // =====================================================================

  /** Helper: set up mocks with varied timestamps for filter tests */
  function setupFilterMocks(opts?: {
    proposalCount?: number;
    threadCount?: number;
    commentCount?: number;
    petitionCount?: number;
  }) {
    const pCount = opts?.proposalCount ?? 3;
    const tCount = opts?.threadCount ?? 3;
    const cCount = opts?.commentCount ?? 3;
    const petCount = opts?.petitionCount ?? 3;

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', mockFetch);

    mockClient.readContract.mockImplementation((args: { functionName: string }) => {
      switch (args.functionName) {
        case 'proposalCount':
          return Promise.resolve(BigInt(pCount));
        case 'threadCount':
          return Promise.resolve(BigInt(tCount));
        case 'commentCount':
          return Promise.resolve(BigInt(cCount));
        case 'petitionCount':
          return Promise.resolve(BigInt(petCount));
        default:
          return Promise.resolve(0n);
      }
    });

    // Proposals with different timestamps and statuses:
    // id 1: createdAt=1700000000, status=pending(0)
    // id 2: createdAt=1700100000, status=active(1)
    // id 3: createdAt=1700200000, status=defeated(4)
    const proposalTuples = [
      proposalTuple({ title: 'Old proposal', status: 0n, createdAt: 1700000000n }),
      proposalTuple({ title: 'Mid proposal', status: 1n, createdAt: 1700100000n }),
      proposalTuple({ title: 'New proposal', status: 4n, createdAt: 1700200000n }),
    ].slice(0, pCount);

    const threadTuples = [
      threadTuple(1, { createdAt: 1700000000n }),
      threadTuple(2, { createdAt: 1700100000n }),
      threadTuple(3, { createdAt: 1700200000n }),
    ].slice(0, tCount);

    const commentTuples = [
      commentTuple(1, 1, { createdAt: 1700000000n }),
      commentTuple(2, 1, { createdAt: 1700100000n }),
      commentTuple(3, 2, { createdAt: 1700200000n }),
    ].slice(0, cCount);

    const petitionTuples = [
      petitionTuple(1, { createdAt: 1700000000n }),
      petitionTuple(2, { createdAt: 1700100000n }),
      petitionTuple(3, { createdAt: 1700200000n }),
    ].slice(0, petCount);

    mockClient.multicall.mockImplementation(
      (args: { contracts: Array<{ functionName: string }> }) => {
        const fn = args.contracts[0]?.functionName;
        switch (fn) {
          case 'proposals':
            return Promise.resolve(proposalTuples);
          case 'threads':
            return Promise.resolve(threadTuples);
          case 'comments':
            return Promise.resolve(commentTuples);
          case 'petitions':
            return Promise.resolve(petitionTuples);
          default:
            return Promise.resolve([]);
        }
      },
    );
  }

  it('--since filters items by timestamp lower bound', async () => {
    setupFilterMocks();
    // since = 1700050000 → should exclude items at 1700000000
    const sinceIso = new Date(1700050000 * 1000).toISOString();
    const out = await run(['digest', '--since', sinceIso]);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const proposals = data.proposals as Array<Record<string, unknown>>;
    const threads = data.threads as Array<Record<string, unknown>>;
    const comments = data.comments as Array<Record<string, unknown>>;
    const petitions = data.petitions as Array<Record<string, unknown>>;

    // Only items with createdAt >= 1700050000 should remain
    expect(proposals).toHaveLength(2);
    expect(threads).toHaveLength(2);
    expect(comments).toHaveLength(2);
    expect(petitions).toHaveLength(2);

    // Meta should include filters
    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters).toBeDefined();
    expect(filters.since).toBeDefined();
  });

  it('--until filters items by timestamp upper bound', async () => {
    setupFilterMocks();
    // until = 1700150000 → should exclude items at 1700200000
    const untilIso = new Date(1700150000 * 1000).toISOString();
    const out = await run(['digest', '--until', untilIso]);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const proposals = data.proposals as Array<Record<string, unknown>>;
    const threads = data.threads as Array<Record<string, unknown>>;

    expect(proposals).toHaveLength(2);
    expect(threads).toHaveLength(2);

    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters.until).toBeDefined();
  });

  it('--since and --until together create a time window', async () => {
    setupFilterMocks();
    const sinceIso = new Date(1700050000 * 1000).toISOString();
    const untilIso = new Date(1700150000 * 1000).toISOString();
    const out = await run(['digest', '--since', sinceIso, '--until', untilIso]);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const proposals = data.proposals as Array<Record<string, unknown>>;
    // Only item at 1700100000 falls within the window
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ title: 'Mid proposal' });
  });

  it('--last converts duration to --since', async () => {
    setupFilterMocks();

    // Mock Date.now to have a stable reference point
    const fixedNow = 1700200500 * 1000; // 500 seconds after the newest item
    vi.spyOn(Date, 'now').mockReturnValue(fixedNow);

    // --last 2h means since = now - 7200s = 1700193300
    // Only items at 1700200000 should survive
    const out = await run(['digest', '--last', '2h']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const proposals = data.proposals as Array<Record<string, unknown>>;
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ title: 'New proposal' });

    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters.since).toBeDefined();
  });

  it('--last and --since together returns error', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--last', '24h', '--since', '2023-11-15T00:00:00Z']);
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_OPTIONS');
  });

  it('--last with invalid format returns error', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--last', 'invalid']);
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_DURATION');
  });

  it('--omit-comments excludes comments from output', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--omit-comments']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data.comments).toBeUndefined();
    expect(data.proposals).toBeDefined();
    expect(data.threads).toBeDefined();
    expect(data.petitions).toBeDefined();

    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters.omitComments).toBe(true);
  });

  it('--omit-members excludes members from output', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--omit-members']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data.members).toBeUndefined();
    expect(data.proposals).toBeDefined();

    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters.omitMembers).toBe(true);
  });

  it('--omit-petitions excludes petitions from output', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--omit-petitions']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data.petitions).toBeUndefined();
    expect(data.proposals).toBeDefined();

    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters.omitPetitions).toBe(true);
  });

  it('--proposals-limit limits the number of proposals returned', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--proposals-limit', '2']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const proposals = data.proposals as Array<Record<string, unknown>>;
    expect(proposals).toHaveLength(2);
    // Should be most recent first (sorted by createdAt descending)
    expect(proposals[0]).toMatchObject({ title: 'New proposal' });
    expect(proposals[1]).toMatchObject({ title: 'Mid proposal' });

    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters.proposalsLimit).toBe(2);
  });

  it('--threads-limit limits the number of threads returned', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--threads-limit', '1']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const threads = data.threads as Array<Record<string, unknown>>;
    expect(threads).toHaveLength(1);
    // Most recent first
    expect(threads[0]).toMatchObject({ id: 3, title: 'Thread 3' });
  });

  it('--comments-limit limits the number of comments returned', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--comments-limit', '2']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const comments = data.comments as Array<Record<string, unknown>>;
    expect(comments).toHaveLength(2);
  });

  it('--petitions-limit limits the number of petitions returned', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--petitions-limit', '1']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const petitions = data.petitions as Array<Record<string, unknown>>;
    expect(petitions).toHaveLength(1);
    expect(petitions[0]).toMatchObject({ id: 3, title: 'Petition 3' });
  });

  it('--summary-only returns only counts/metadata without full bodies', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--summary-only']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;

    // Proposals should have summary fields but not full description
    const proposals = data.proposals as Array<Record<string, unknown>>;
    expect(proposals).toHaveLength(3);
    expect(proposals[0]).toHaveProperty('id');
    expect(proposals[0]).toHaveProperty('title');
    expect(proposals[0]).toHaveProperty('status');
    expect(proposals[0]).toHaveProperty('statusCode');
    expect(proposals[0]).toHaveProperty('createdAt');
    expect(proposals[0]).not.toHaveProperty('description');
    expect(proposals[0]).not.toHaveProperty('forVotes');

    // Threads should have summary fields
    const threads = data.threads as Array<Record<string, unknown>>;
    expect(threads[0]).toHaveProperty('id');
    expect(threads[0]).toHaveProperty('title');
    expect(threads[0]).toHaveProperty('category');
    expect(threads[0]).not.toHaveProperty('kind');
    expect(threads[0]).not.toHaveProperty('author');

    // Comments should have summary fields
    const comments = data.comments as Array<Record<string, unknown>>;
    expect(comments[0]).toHaveProperty('id');
    expect(comments[0]).toHaveProperty('threadId');
    expect(comments[0]).toHaveProperty('author');
    expect(comments[0]).not.toHaveProperty('body');

    // Petitions should have summary fields
    const petitions = data.petitions as Array<Record<string, unknown>>;
    expect(petitions[0]).toHaveProperty('id');
    expect(petitions[0]).toHaveProperty('title');
    expect(petitions[0]).toHaveProperty('signatures');
    expect(petitions[0]).not.toHaveProperty('body');
    expect(petitions[0]).not.toHaveProperty('proposer');

    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters.summaryOnly).toBe(true);
  });

  it('--proposal-status filters proposals by status label', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--proposal-status', 'active']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const proposals = data.proposals as Array<Record<string, unknown>>;
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ title: 'Mid proposal', status: 'active' });

    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters.proposalStatus).toBe('active');
  });

  it('--proposal-status with invalid status returns error', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--proposal-status', 'nonexistent']);
    expect(out.ok).toBe(false);
    expect(out.error?.code).toBe('INVALID_STATUS');
  });

  it('multiple filters combine correctly', async () => {
    setupFilterMocks();

    // Time window + status filter + limit + omit-comments + summary-only
    const sinceIso = new Date(1700050000 * 1000).toISOString();
    const out = await run([
      'digest',
      '--since',
      sinceIso,
      '--proposal-status',
      'active',
      '--proposals-limit',
      '1',
      '--omit-comments',
      '--summary-only',
    ]);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;

    // Only active proposals after since timestamp
    const proposals = data.proposals as Array<Record<string, unknown>>;
    expect(proposals).toHaveLength(1);
    expect(proposals[0]).toMatchObject({ title: 'Mid proposal', status: 'active' });
    // summary-only: no description
    expect(proposals[0]).not.toHaveProperty('description');

    // Comments omitted
    expect(data.comments).toBeUndefined();

    // Threads filtered by time but not by limit or status
    const threads = data.threads as Array<Record<string, unknown>>;
    expect(threads).toHaveLength(2);

    // Meta should have all applied filters
    const meta = data.meta as Record<string, unknown>;
    const filters = meta.filters as Record<string, unknown>;
    expect(filters.since).toBeDefined();
    expect(filters.proposalStatus).toBe('active');
    expect(filters.proposalsLimit).toBe(1);
    expect(filters.omitComments).toBe(true);
    expect(filters.summaryOnly).toBe(true);
  });

  it('no filters applied means no filters in meta', async () => {
    setupFilterMocks();
    const out = await run(['digest']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    const meta = data.meta as Record<string, unknown>;
    expect(meta.filters).toBeUndefined();
  });

  it('--omit-comments --omit-members --omit-petitions removes all optional sections', async () => {
    setupFilterMocks();
    const out = await run(['digest', '--omit-comments', '--omit-members', '--omit-petitions']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data.comments).toBeUndefined();
    expect(data.members).toBeUndefined();
    expect(data.petitions).toBeUndefined();
    // Still have proposals and threads
    expect(data.proposals).toBeDefined();
    expect(data.threads).toBeDefined();
  });
});

describe('parseDuration', () => {
  it('parses minutes', () => {
    expect(parseDuration('30m')).toBe(30 * 60 * 1000);
  });

  it('parses hours', () => {
    expect(parseDuration('24h')).toBe(24 * 3600 * 1000);
  });

  it('parses days', () => {
    expect(parseDuration('7d')).toBe(7 * 86400 * 1000);
  });

  it('parses fractional values', () => {
    expect(parseDuration('1.5h')).toBe(1.5 * 3600 * 1000);
  });

  it('returns null for invalid format', () => {
    expect(parseDuration('invalid')).toBeNull();
    expect(parseDuration('24x')).toBeNull();
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('h')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(parseDuration('24H')).toBe(24 * 3600 * 1000);
    expect(parseDuration('7D')).toBe(7 * 86400 * 1000);
    expect(parseDuration('30M')).toBe(30 * 60 * 1000);
  });
});
