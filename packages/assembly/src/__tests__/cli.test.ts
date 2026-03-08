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

const addrA = '0x00000000000000000000000000000000000000aa';
const addrB = '0x00000000000000000000000000000000000000bb';

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
    const data = out.data as Array<Record<string, unknown>>;
    expect(data).toHaveLength(2);
    expect(stderrSpy).toHaveBeenCalledWith(
      expect.stringContaining('"code":"ASSEMBLY_INDEXER_UNAVAILABLE"'),
    );
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

  it('council seat returns OUT_OF_RANGE when id >= seatCount', async () => {
    mockClient.readContract.mockResolvedValueOnce(2n);

    const out = await run(['council', 'seat', '2']);

    expect(out.ok).toBe(false);
    expect(out.error).toMatchObject({ code: 'OUT_OF_RANGE' });
    expect(out.error?.message).toContain('seatCount: 2');
    expect(mockClient.readContract).toHaveBeenCalledTimes(1);
  });

  it('council auctions includes window metadata and derives bidding/closed status', async () => {
    mockClient.readContract
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(0n)
      .mockResolvedValueOnce(2n);
    mockClient.multicall
      .mockResolvedValueOnce([
        [addrA, 123n, false],
        [addrB, 456n, false],
      ])
      .mockResolvedValueOnce([200n, 100n]);
    mockClient.getBlock.mockResolvedValueOnce({ timestamp: 150n });

    const out = await run(['council', 'auctions']);
    expect(out.ok).toBe(true);

    const data = out.data as { auctions: Array<Record<string, unknown>> };
    expect(data.auctions).toHaveLength(2);
    expect(data.auctions[0]).toMatchObject({ windowEnd: 200, status: 'bidding', settled: false });
    expect(data.auctions[1]).toMatchObject({ windowEnd: 100, status: 'closed', settled: false });
    expect(typeof data.auctions[0]?.windowEndRelative).toBe('string');
  });

  it('council auction includes window metadata and settled status', async () => {
    mockClient.readContract.mockResolvedValueOnce([addrA, 123n, true]).mockResolvedValueOnce(999n);
    mockClient.getBlock.mockResolvedValueOnce({ timestamp: 150n });

    const out = await run(['council', 'auction', '0', '0']);
    expect(out.ok).toBe(true);

    const data = out.data as Record<string, unknown>;
    expect(data).toMatchObject({
      settled: true,
      windowEnd: 999,
      status: 'settled',
    });
    expect(typeof data.highestBidder).toBe('string');
    expect(typeof data.highestBid).toBe('string');
    expect(typeof data.windowEndRelative).toBe('string');
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
    expect(data.proposals[0]).toMatchObject({ id: 1, kind: 1, status: 4, voteEndAt: 130 });
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
    expect(data.status).toBe(4);
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
