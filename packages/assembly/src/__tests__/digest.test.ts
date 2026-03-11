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

function proposalTuple(overrides?: { status?: bigint; title?: string }) {
  return [
    1n, // kind
    0n, // configRiskTier
    0n, // origin
    overrides?.status ?? 1n, // status
    addrA, // proposer
    1n, // threadId
    0n, // petitionId
    1700000000n, // createdAt
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

function threadTuple(id: number) {
  return [BigInt(id), 2n, addrA, 1700000000n, 'general', `Thread ${id}`, 'body text', 0n, 0n];
}

function commentTuple(id: number, threadId: number) {
  return [BigInt(id), BigInt(threadId), 0n, addrB, 1700000100n, `Comment ${id}`];
}

function petitionTuple(id: number) {
  return [
    BigInt(id),
    addrA,
    1700000000n,
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

  it('captures partial errors without failing the entire digest', async () => {
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

    const out = await run(['digest']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;

    // Proposals succeeded
    const proposals = data.proposals as Array<Record<string, unknown>>;
    expect(proposals).toHaveLength(1);
    expect(proposals[0].title).toBe('Works');

    // Threads failed — captured in errors
    expect(data.threads).toEqual([]);
    const errors = data.errors as string[];
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e: string) => e.includes('threads'))).toBe(true);
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
});
