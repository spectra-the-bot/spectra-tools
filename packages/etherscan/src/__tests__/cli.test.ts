import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cli } from '../cli.js';

function makeResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function runCli(
  argv: string[],
  mockResponse: Response,
): Promise<{ output: string; exitCode: number; calledUrl: string }> {
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
  return { output, exitCode, calledUrl };
}

describe('etherscan CLI', () => {
  beforeEach(() => {
    process.env.ETHERSCAN_API_KEY = 'test-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'ETHERSCAN_API_KEY');
    vi.unstubAllGlobals();
  });

  it('fails with a structured env error when API key is missing', async () => {
    Reflect.deleteProperty(process.env, 'ETHERSCAN_API_KEY');

    const { output, exitCode } = await runCli(
      ['account', 'balance', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '--json'],
      makeResponse({ status: '1', message: 'OK', result: '0' }),
    );

    expect(exitCode).toBe(1);
    expect(output).toContain('ETHERSCAN_API_KEY');
  });

  describe('account balance', () => {
    it('outputs JSON with address and eth fields', async () => {
      const { output, exitCode } = await runCli(
        ['account', 'balance', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '--json'],
        makeResponse({ status: '1', message: 'OK', result: '1000000000000000000' }),
      );
      expect(exitCode).toBe(0);
      const parsed = JSON.parse(output) as { eth: string; address: string };
      expect(parsed).toHaveProperty('eth');
      expect(parsed).toHaveProperty('address');
    });

    it('converts wei to eth correctly', async () => {
      const { output } = await runCli(
        ['account', 'balance', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '--json'],
        makeResponse({ status: '1', message: 'OK', result: '1000000000000000000' }),
      );
      const parsed = JSON.parse(output) as { eth: string; wei: string };
      expect(parsed.wei).toBe('1000000000000000000');
      expect(parsed.eth).toBe('1');
    });

    it('sends request with correct chain ID for abstract', async () => {
      const { calledUrl } = await runCli(
        [
          'account',
          'balance',
          '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
          '--chain',
          'abstract',
          '--json',
        ],
        makeResponse({ status: '1', message: 'OK', result: '0' }),
      );
      expect(calledUrl).toContain('chainid=2741');
    });

    it('sends request with correct chain ID for ethereum', async () => {
      const { calledUrl } = await runCli(
        [
          'account',
          'balance',
          '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
          '--chain',
          'ethereum',
          '--json',
        ],
        makeResponse({ status: '1', message: 'OK', result: '0' }),
      );
      expect(calledUrl).toContain('chainid=1');
    });
  });

  describe('account balance (invalid address)', () => {
    it('returns INVALID_ADDRESS error for malformed address', async () => {
      const { output, exitCode } = await runCli(
        ['account', 'balance', '0xinvalid', '--json'],
        makeResponse({ status: '1', message: 'OK', result: '0' }),
      );
      expect(exitCode).toBe(1);
      const parsed = JSON.parse(output) as { code: string; message: string };
      expect(parsed.code).toBe('INVALID_ADDRESS');
      expect(parsed.message).toContain('0xinvalid');
    });

    it('returns INVALID_ADDRESS error for non-hex string', async () => {
      const { output, exitCode } = await runCli(
        ['account', 'balance', 'not-an-address', '--json'],
        makeResponse({ status: '1', message: 'OK', result: '0' }),
      );
      expect(exitCode).toBe(1);
      const parsed = JSON.parse(output) as { code: string };
      expect(parsed.code).toBe('INVALID_ADDRESS');
    });
  });

  describe('account txlist', () => {
    it('returns transactions with formatted fields', async () => {
      const { output } = await runCli(
        ['account', 'txlist', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '--json'],
        makeResponse({
          status: '1',
          message: 'OK',
          result: [
            {
              hash: '0xdeadbeef',
              from: '0xabc',
              to: '0xdef',
              value: '1000000000000000000',
              timeStamp: '1700000000',
              blockNumber: '12345',
              isError: '0',
              gasUsed: '21000',
            },
          ],
        }),
      );
      const parsed = JSON.parse(output) as {
        transactions: Array<{ hash: string; status: string; eth: string }>;
      };
      expect(parsed.transactions).toHaveLength(1);
      expect(parsed.transactions[0]?.hash).toBe('0xdeadbeef');
      expect(parsed.transactions[0]?.status).toBe('success');
      expect(parsed.transactions[0]?.eth).toBe('1');
    });
  });

  describe('account txlist (invalid address)', () => {
    it('returns INVALID_ADDRESS error for malformed address', async () => {
      const { output, exitCode } = await runCli(
        ['account', 'txlist', '0xinvalid', '--json'],
        makeResponse({ status: '1', message: 'OK', result: [] }),
      );
      expect(exitCode).toBe(1);
      const parsed = JSON.parse(output) as { code: string };
      expect(parsed.code).toBe('INVALID_ADDRESS');
    });
  });

  describe('contract abi (invalid address)', () => {
    it('returns INVALID_ADDRESS error for malformed address', async () => {
      const { output, exitCode } = await runCli(
        ['contract', 'abi', '0xinvalid', '--json'],
        makeResponse({ status: '1', message: 'OK', result: '[]' }),
      );
      expect(exitCode).toBe(1);
      const parsed = JSON.parse(output) as { code: string; message: string };
      expect(parsed.code).toBe('INVALID_ADDRESS');
      expect(parsed.message).toContain('0xinvalid');
    });
  });

  describe('token info (invalid address)', () => {
    it('returns INVALID_ADDRESS error for malformed contract address', async () => {
      const { output, exitCode } = await runCli(
        ['token', 'info', '0xinvalid', '--json'],
        makeResponse({ status: '1', message: 'OK', result: [] }),
      );
      expect(exitCode).toBe(1);
      const parsed = JSON.parse(output) as { code: string; message: string };
      expect(parsed.code).toBe('INVALID_ADDRESS');
      expect(parsed.message).toContain('0xinvalid');
    });
  });

  describe('stats ethprice', () => {
    it('returns ETH price data', async () => {
      const { output } = await runCli(
        ['stats', 'ethprice', '--json'],
        makeResponse({
          status: '1',
          message: 'OK',
          result: {
            ethbtc: '0.05',
            ethbtc_timestamp: '1700000000',
            ethusd: '2000.00',
            ethusd_timestamp: '1700000000',
          },
        }),
      );
      const parsed = JSON.parse(output) as { usd: string; btc: string };
      expect(parsed.usd).toBe('2000.00');
      expect(parsed.btc).toBe('0.05');
    });
  });

  describe('gas oracle', () => {
    it('returns gas price tiers', async () => {
      const { output } = await runCli(
        ['gas', 'oracle', '--json'],
        makeResponse({
          status: '1',
          message: 'OK',
          result: {
            LastBlock: '12345',
            SafeGasPrice: '10',
            ProposeGasPrice: '15',
            FastGasPrice: '20',
            suggestBaseFee: '9',
            gasUsedRatio: '0.5',
          },
        }),
      );
      const parsed = JSON.parse(output) as { slow: string; standard: string; fast: string };
      expect(parsed.slow).toBe('10 Gwei');
      expect(parsed.standard).toBe('15 Gwei');
      expect(parsed.fast).toBe('20 Gwei');
    });
  });
});
