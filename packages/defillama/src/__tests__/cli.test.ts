import { afterEach, describe, expect, it, vi } from 'vitest';
import { cli } from '../cli.js';

function makeResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

async function runCli(
  argv: string[],
  responseBody: unknown,
): Promise<{ output: string; exitCode: number }> {
  const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(makeResponse(responseBody));
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

  return { output, exitCode };
}

const coin = 'ethereum:0xdac17f958d2ee523a2206206994597c13d831ec7';

describe('defillama CLI CTAs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds CTA for tvl protocols', async () => {
    const { output, exitCode } = await runCli(
      ['tvl', 'protocols', '--limit', '1'],
      [
        {
          id: '1',
          name: 'Aave',
          slug: 'aave',
          category: 'Lending',
          chains: ['Ethereum'],
          tvl: 1_000_000,
          change_1d: 1.5,
          change_7d: 3.2,
        },
      ],
    );

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama tvl protocol aave');
  });

  it('adds CTA for tvl chains', async () => {
    const { output, exitCode } = await runCli(
      ['tvl', 'chains', '--limit', '1'],
      [{ name: 'Ethereum', tvl: 50_000_000 }],
    );

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama tvl protocols --chain ethereum');
  });

  it('adds CTA for tvl protocol', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { output, exitCode } = await runCli(['tvl', 'protocol', 'aave'], {
      id: '1',
      name: 'Aave',
      slug: 'aave',
      category: 'Lending',
      tvl: [{ date: now, totalLiquidityUSD: 1_000_000 }],
      currentChainTvls: { Ethereum: 1_000_000 },
    });

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama tvl history aave --days 30');
  });

  it('adds CTA for tvl history', async () => {
    const now = Math.floor(Date.now() / 1000);
    const { output, exitCode } = await runCli(['tvl', 'history', 'aave', '--days', '7'], {
      id: '1',
      name: 'Aave',
      slug: 'aave',
      tvl: [{ date: now, totalLiquidityUSD: 1_000_000 }],
    });

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama tvl protocol aave');
  });

  it('adds CTA for protocols list', async () => {
    const { output, exitCode } = await runCli(
      ['protocols', 'list', '--limit', '1'],
      [
        {
          id: '1',
          name: 'Aave',
          slug: 'aave',
          category: 'Lending',
          chains: ['Ethereum'],
          tvl: 1_000_000,
          change_1d: 1.5,
          change_7d: 3.2,
        },
      ],
    );

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama tvl protocol aave');
  });

  it('adds CTA for prices current', async () => {
    const { output, exitCode } = await runCli(['prices', 'current', coin], {
      coins: {
        [coin]: {
          price: 1,
          symbol: 'USDT',
          timestamp: 1_700_000_000,
        },
      },
    });

    expect(exitCode).toBe(0);
    expect(output).toContain(`defillama prices historical ${coin} --date <date>`);
  });

  it('adds CTA for prices historical', async () => {
    const { output, exitCode } = await runCli(
      ['prices', 'historical', coin, '--date', '2025-01-01'],
      {
        coins: {
          [coin]: {
            price: 1,
            symbol: 'USDT',
            timestamp: 1_700_000_000,
          },
        },
      },
    );

    expect(exitCode).toBe(0);
    expect(output).toContain(`defillama prices chart ${coin} --start 2025-01-01 --period 1d`);
  });

  it('adds CTA for prices chart', async () => {
    const { output, exitCode } = await runCli(['prices', 'chart', coin], {
      coins: {
        [coin]: {
          symbol: 'USDT',
          prices: [{ timestamp: 1_700_000_000, price: 1 }],
        },
      },
    });

    expect(exitCode).toBe(0);
    expect(output).toContain(`defillama prices current ${coin}`);
  });

  it('adds CTA for fees overview', async () => {
    const { output, exitCode } = await runCli(['fees', 'overview', '--limit', '1'], {
      protocols: [
        {
          name: 'Uniswap',
          displayName: 'Uniswap',
          slug: 'uniswap',
          category: 'Dexs',
          chains: ['Ethereum'],
          total24h: 100_000,
          total7d: 700_000,
          change_1d: 2,
        },
      ],
      allChains: ['Ethereum'],
    });

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama fees protocol uniswap');
  });

  it('adds CTA for fees protocol', async () => {
    const { output, exitCode } = await runCli(['fees', 'protocol', 'uniswap'], {
      name: 'Uniswap',
      displayName: 'Uniswap',
      slug: 'uniswap',
      chains: ['Ethereum'],
      total24h: 100_000,
      total7d: 700_000,
      total30d: 3_000_000,
      totalAllTime: 50_000_000,
      change_1d: 2,
      change_7d: 5,
      change_1m: 10,
    });

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama fees overview --chain ethereum');
  });

  it('adds CTA for volume dexs', async () => {
    const { output, exitCode } = await runCli(['volume', 'dexs', '--limit', '1'], {
      protocols: [
        {
          name: 'Uniswap',
          displayName: 'Uniswap',
          slug: 'uniswap',
          category: 'Dexs',
          chains: ['Ethereum'],
          total24h: 100_000,
          total7d: 700_000,
          change_1d: 2,
        },
      ],
      allChains: ['Ethereum'],
    });

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama volume protocol uniswap');
  });

  it('adds CTA for volume overview', async () => {
    const { output, exitCode } = await runCli(['volume', 'overview', '--chain', 'ethereum'], {
      protocols: [
        {
          name: 'Uniswap',
          displayName: 'Uniswap',
          slug: 'uniswap',
          category: 'Dexs',
          chains: ['Ethereum'],
          total24h: 100_000,
          total7d: 700_000,
          change_1d: 2,
        },
      ],
      allChains: ['Ethereum'],
      chain: 'ethereum',
    });

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama volume protocol uniswap');
    expect(output).toContain('defillama fees overview --chain ethereum');
  });

  it('adds CTA for volume protocol', async () => {
    const { output, exitCode } = await runCli(['volume', 'protocol', 'uniswap'], {
      name: 'Uniswap',
      displayName: 'Uniswap',
      slug: 'uniswap',
      chains: ['Ethereum'],
      total24h: 100_000,
      total7d: 700_000,
      total30d: 3_000_000,
      totalAllTime: 50_000_000,
      change_1d: 2,
      change_7d: 5,
      change_1m: 10,
    });

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama fees protocol uniswap');
  });

  it('adds CTA for volume aggregators', async () => {
    const { output, exitCode } = await runCli(['volume', 'aggregators', '--limit', '1'], {
      protocols: [
        {
          name: '1inch',
          displayName: '1inch',
          slug: '1inch',
          chains: ['Ethereum'],
          total24h: 50_000,
          total7d: 300_000,
          change_1d: 1,
        },
      ],
      allChains: ['Ethereum'],
    });

    expect(exitCode).toBe(0);
    expect(output).toContain('defillama volume overview --chain ethereum');
  });
});
