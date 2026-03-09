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

describe('etherscan CLI account/logs extensions', () => {
  beforeEach(() => {
    process.env.ETHERSCAN_API_KEY = 'test-key';
  });

  afterEach(() => {
    Reflect.deleteProperty(process.env, 'ETHERSCAN_API_KEY');
    vi.unstubAllGlobals();
  });

  describe('account internaltx', () => {
    it('returns internal transactions with normalized shape', async () => {
      const { output, calledUrl, exitCode } = await runCli(
        ['account', 'internaltx', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '--json'],
        makeResponse({
          status: '1',
          message: 'OK',
          result: [
            {
              hash: '0xinternal',
              from: '0x742d35cc6634c0532925a3b844bc454e4438f44e',
              to: '0x1111111111111111111111111111111111111111',
              value: '2000000000000000000',
              timeStamp: '1700000000',
              blockNumber: '1234',
              type: 'call',
              traceId: '0_1',
              isError: '0',
              gasUsed: '21000',
            },
          ],
        }),
      );

      expect(exitCode).toBe(0);
      expect(calledUrl).toContain('action=txlistinternal');

      const parsed = JSON.parse(output) as {
        count: number;
        transactions: Array<{ hash: string; status: string; eth: string; type?: string }>;
      };
      expect(parsed.count).toBe(1);
      expect(parsed.transactions[0]?.hash).toBe('0xinternal');
      expect(parsed.transactions[0]?.status).toBe('success');
      expect(parsed.transactions[0]?.eth).toBe('2');
      expect(parsed.transactions[0]?.type).toBe('call');
    });

    it('returns INVALID_ADDRESS error for malformed address', async () => {
      const { output, exitCode } = await runCli(
        ['account', 'internaltx', '0xinvalid', '--json'],
        makeResponse({ status: '1', message: 'OK', result: [] }),
      );
      expect(exitCode).toBe(1);
      const parsed = JSON.parse(output) as { code: string };
      expect(parsed.code).toBe('INVALID_ADDRESS');
    });
  });

  describe('account nfttx and erc1155tx', () => {
    it('returns ERC-721 transfers', async () => {
      const { output, calledUrl, exitCode } = await runCli(
        ['account', 'nfttx', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '--json'],
        makeResponse({
          status: '1',
          message: 'OK',
          result: [
            {
              hash: '0xnft',
              from: '0x1111111111111111111111111111111111111111',
              to: '0x742d35cc6634c0532925a3b844bc454e4438f44e',
              tokenID: '42',
              tokenName: 'CoolNFT',
              tokenSymbol: 'COOL',
              timeStamp: '1700000000',
              contractAddress: '0x2222222222222222222222222222222222222222',
            },
          ],
        }),
      );

      expect(exitCode).toBe(0);
      expect(calledUrl).toContain('action=tokennfttx');
      const parsed = JSON.parse(output) as {
        count: number;
        transfers: Array<{ tokenId: string; tokenName: string }>;
      };
      expect(parsed.count).toBe(1);
      expect(parsed.transfers[0]?.tokenId).toBe('42');
      expect(parsed.transfers[0]?.tokenName).toBe('CoolNFT');
    });

    it('returns ERC-1155 transfers with amount', async () => {
      const { output, calledUrl, exitCode } = await runCli(
        ['account', 'erc1155tx', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '--json'],
        makeResponse({
          status: '1',
          message: 'OK',
          result: [
            {
              hash: '0x1155',
              from: '0x1111111111111111111111111111111111111111',
              to: '0x742d35cc6634c0532925a3b844bc454e4438f44e',
              tokenID: '7',
              tokenValue: '5',
              tokenName: 'Items',
              tokenSymbol: 'ITEM',
              timeStamp: '1700000000',
              contractAddress: '0x3333333333333333333333333333333333333333',
            },
          ],
        }),
      );

      expect(exitCode).toBe(0);
      expect(calledUrl).toContain('action=token1155tx');
      const parsed = JSON.parse(output) as {
        count: number;
        transfers: Array<{ tokenId: string; amount: string }>;
      };
      expect(parsed.count).toBe(1);
      expect(parsed.transfers[0]?.tokenId).toBe('7');
      expect(parsed.transfers[0]?.amount).toBe('5');
    });

    it('fails on malformed API result shape', async () => {
      const { output, exitCode } = await runCli(
        ['account', 'nfttx', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', '--json'],
        makeResponse({
          status: '1',
          message: 'OK',
          result: [
            {
              hash: '0xbad',
            },
          ],
        }),
      );

      expect(exitCode).toBe(1);
      expect(output).toContain('Etherscan response validation failed');
    });
  });

  describe('logs get', () => {
    const topic0 = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55aebec6f6f3c';

    it('queries logs with filter params and returns structured output', async () => {
      const { output, calledUrl, exitCode } = await runCli(
        [
          'logs',
          'get',
          '--address',
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          '--topic0',
          topic0,
          '--fromblock',
          '20000000',
          '--toblock',
          '20000100',
          '--json',
        ],
        makeResponse({
          status: '1',
          message: 'OK',
          result: [
            {
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
              topics: [topic0],
              data: '0x00',
              blockNumber: '20000001',
              timeStamp: '1700000000',
              gasPrice: '1000000000',
              gasUsed: '21000',
              logIndex: '15',
              transactionHash: '0xlogtx',
              transactionIndex: '3',
            },
          ],
        }),
      );

      expect(exitCode).toBe(0);
      expect(calledUrl).toContain('module=logs');
      expect(calledUrl).toContain('action=getLogs');
      expect(calledUrl).toContain('topic0=');
      expect(calledUrl).toContain('fromBlock=20000000');
      expect(calledUrl).toContain('toBlock=20000100');

      const parsed = JSON.parse(output) as {
        count: number;
        logs: Array<{ block: string; transactionHash: string }>;
      };
      expect(parsed.count).toBe(1);
      expect(parsed.logs[0]?.block).toBe('20000001');
      expect(parsed.logs[0]?.transactionHash).toBe('0xlogtx');
    });

    it('returns INVALID_ADDRESS for malformed address filter', async () => {
      const { output, exitCode } = await runCli(
        ['logs', 'get', '--address', '0xinvalid', '--json'],
        makeResponse({ status: '1', message: 'OK', result: [] }),
      );

      expect(exitCode).toBe(1);
      const parsed = JSON.parse(output) as { code: string };
      expect(parsed.code).toBe('INVALID_ADDRESS');
    });

    it('fails on malformed API result shape', async () => {
      const { output, exitCode } = await runCli(
        ['logs', 'get', '--json'],
        makeResponse({
          status: '1',
          message: 'OK',
          result: [{ address: '0xabc' }],
        }),
      );

      expect(exitCode).toBe(1);
      expect(output).toContain('Etherscan response validation failed');
    });
  });
});
