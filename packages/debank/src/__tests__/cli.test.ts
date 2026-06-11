import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cli } from '../cli.js';

function makeResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function runCli(
  argv: string[],
  mockResponse: Response,
): Promise<{
  output: string;
  exitCode: number;
  calledUrl: string;
  calledInit: RequestInit | undefined;
}> {
  const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(mockResponse);
  vi.stubGlobal('fetch', mockFetch);
  let output = '';
  let exitCode = 0;
  await cli.serve(argv, {
    stdout: (s) => {
      output += s;
    },
    exit: (code) => {
      exitCode = code;
    },
  });
  const calledUrl = (mockFetch.mock.calls[0]?.[0] as string) ?? '';
  const calledInit = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
  return { output, exitCode, calledUrl, calledInit };
}

describe('debank CLI', () => {
  beforeEach(() => {
    process.env.ACCESS_KEY = 'test-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'ACCESS_KEY');
    vi.unstubAllGlobals();
  });

  it('fails with a structured env error when ACCESS_KEY is missing', async () => {
    Reflect.deleteProperty(process.env, 'ACCESS_KEY');
    const { output, exitCode } = await runCli(['chain', 'list', '--json'], makeResponse([]));
    expect(exitCode).toBe(1);
    expect(output).toContain('ACCESS_KEY');
  });

  describe('auth header', () => {
    it('sends the AccessKey header (not a query param)', async () => {
      const { calledUrl, calledInit } = await runCli(
        ['chain', 'info', 'eth', '--json'],
        makeResponse({ id: 'eth', name: 'Ethereum' }),
      );
      const headers = new Headers(calledInit?.headers as HeadersInit);
      expect(headers.get('AccessKey')).toBe('test-key');
      expect(calledUrl).not.toContain('test-key');
      expect(calledUrl).not.toContain('AccessKey=');
    });
  });

  describe('chain info', () => {
    it('hits /v1/chain with the resolved chain id', async () => {
      const { calledUrl, exitCode } = await runCli(
        ['chain', 'info', 'ethereum', '--json'],
        makeResponse({ id: 'eth', name: 'Ethereum' }),
      );
      expect(exitCode).toBe(0);
      expect(calledUrl).toContain('/v1/chain?');
      expect(calledUrl).toContain('id=eth'); // alias "ethereum" -> "eth"
    });
  });

  describe('chain list', () => {
    it('paginates the result array', async () => {
      const chains = Array.from({ length: 12 }, (_, i) => ({ id: `chain${i}` }));
      const { output, exitCode } = await runCli(
        ['chain', 'list', '--page', '1', '--page-size', '5', '--json'],
        makeResponse(chains),
      );
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(output) as {
        data: unknown[];
        pagination: { totalItems: number; totalPages: number; page: number };
      };
      expect(parsed.data).toHaveLength(5);
      expect(parsed.pagination.totalItems).toBe(12);
      expect(parsed.pagination.totalPages).toBe(3);
    });

    it('--json output does not contain CTA keys', async () => {
      const { output } = await runCli(['chain', 'list', '--json'], makeResponse([]));
      const parsed = JSON.parse(output);
      expect(parsed).not.toHaveProperty('cta');
    });
  });

  describe('protocol list', () => {
    it('sorts protocols by TVL descending before paginating', async () => {
      const { output } = await runCli(
        ['protocol', 'list', 'eth', '--json'],
        makeResponse([
          { id: 'low', tvl: 100 },
          { id: 'high', tvl: 9000 },
          { id: 'mid', tvl: 500 },
        ]),
      );
      const parsed = JSON.parse(output) as { data: Array<{ id: string }> };
      expect(parsed.data.map((p) => p.id)).toEqual(['high', 'mid', 'low']);
    });

    it('passes chain_id to the protocol list endpoint', async () => {
      const { calledUrl } = await runCli(['protocol', 'list', 'bsc', '--json'], makeResponse([]));
      expect(calledUrl).toContain('/v1/protocol/list?');
      expect(calledUrl).toContain('chain_id=bsc');
    });
  });

  describe('token info', () => {
    it('hits /v1/token with chain_id and id', async () => {
      const { calledUrl } = await runCli(
        ['token', 'info', 'eth', '0xabc', '--json'],
        makeResponse({ id: '0xabc', symbol: 'USDC' }),
      );
      expect(calledUrl).toContain('/v1/token?');
      expect(calledUrl).toContain('chain_id=eth');
      expect(calledUrl).toContain('id=0xabc');
    });
  });

  describe('user balance', () => {
    it('uses total_balance when no chain is given', async () => {
      const { calledUrl } = await runCli(
        ['user', 'balance', '0xwallet', '--json'],
        makeResponse({ total_usd_value: 1234 }),
      );
      expect(calledUrl).toContain('/v1/user/total_balance?');
      expect(calledUrl).toContain('id=0xwallet');
    });

    it('uses chain_balance when a chain is given', async () => {
      const { calledUrl } = await runCli(
        ['user', 'balance', '0xwallet', '--chain', 'eth', '--json'],
        makeResponse({ usd_value: 1234 }),
      );
      expect(calledUrl).toContain('/v1/user/chain_balance?');
      expect(calledUrl).toContain('chain_id=eth');
    });
  });

  describe('user protocols', () => {
    it('uses the simple list by default', async () => {
      const { calledUrl } = await runCli(
        ['user', 'protocols', '0xwallet', '--chain', 'eth', '--json'],
        makeResponse([]),
      );
      expect(calledUrl).toContain('/v1/user/simple_protocol_list?');
    });

    it('uses the complex list when --complex is set', async () => {
      const { calledUrl } = await runCli(
        ['user', 'protocols', '0xwallet', '--chain', 'eth', '--complex', '--json'],
        makeResponse([]),
      );
      expect(calledUrl).toContain('/v1/user/complex_protocol_list?');
    });
  });

  describe('wallet gas', () => {
    it('hits the gas_market endpoint with chain_id', async () => {
      const { calledUrl, exitCode } = await runCli(
        ['wallet', 'gas', 'eth', '--json'],
        makeResponse([{ level: 'fast', price: 20 }]),
      );
      expect(exitCode).toBe(0);
      expect(calledUrl).toContain('/v1/wallet/gas_market?');
      expect(calledUrl).toContain('chain_id=eth');
    });
  });

  describe('wallet simulate', () => {
    it('POSTs the tx body to pre_exec_tx and does not sign', async () => {
      const { calledUrl, calledInit, exitCode } = await runCli(
        ['wallet', 'simulate', '{"from":"0xabc","to":"0xdef","value":"0x0"}', '--json'],
        makeResponse({ success: true }),
      );
      expect(exitCode).toBe(0);
      expect(calledUrl).toContain('/v1/wallet/pre_exec_tx');
      expect(calledInit?.method).toBe('POST');
      const body = JSON.parse(calledInit?.body as string) as { tx: { from: string } };
      expect(body.tx.from).toBe('0xabc');
    });
  });

  describe('API error handling', () => {
    it('surfaces a structured DEBANK_API_ERROR on non-2xx', async () => {
      const { output, exitCode } = await runCli(
        ['chain', 'info', 'eth', '--json'],
        makeResponse({ message: 'invalid access key' }, 401),
      );
      expect(exitCode).toBe(1);
      const parsed = JSON.parse(output) as { code: string };
      expect(parsed.code).toBe('DEBANK_API_ERROR');
    });
  });
});
