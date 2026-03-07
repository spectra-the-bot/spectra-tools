import { Cli, z } from 'incur';
import { apiKeyAuth, createRateLimiter, withRateLimit } from '@spectra-the-bot/cli-shared';
import { createEtherscanClient } from '../api.js';
import { resolveChainId, DEFAULT_CHAIN } from '../chains.js';

const rateLimiter = createRateLimiter({ requestsPerSecond: 5 });

const chainOption = z
  .string()
  .default(DEFAULT_CHAIN)
  .describe('Chain name (abstract, ethereum, base, arbitrum, ...)');

export const statsCli = Cli.create('stats', {
  description: 'Query ETH price and supply statistics',
});

interface EthPrice {
  ethbtc: string;
  ethbtc_timestamp: string;
  ethusd: string;
  ethusd_timestamp: string;
}

statsCli.command('ethprice', {
  description: 'Get the latest ETH price in USD and BTC',
  options: z.object({
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const price = await withRateLimit(
      () =>
        client.call<EthPrice>({
          chainid: chainId,
          module: 'stats',
          action: 'ethprice',
        }),
      rateLimiter,
    );
    return c.ok(
      {
        chain: c.options.chain,
        usd: price.ethusd,
        btc: price.ethbtc,
        usdTimestamp: new Date(Number(price.ethusd_timestamp) * 1000).toISOString(),
        btcTimestamp: new Date(Number(price.ethbtc_timestamp) * 1000).toISOString(),
      },
      {
        cta: {
          commands: [
            {
              command: 'stats ethsupply',
              description: 'Get total ETH supply',
            },
          ],
        },
      },
    );
  },
});

statsCli.command('ethsupply', {
  description: 'Get the total supply of ETH',
  options: z.object({
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const supply = await withRateLimit(
      () =>
        client.call<string>({
          chainid: chainId,
          module: 'stats',
          action: 'ethsupply',
        }),
      rateLimiter,
    );
    return c.ok(
      {
        chain: c.options.chain,
        totalSupplyWei: supply,
      },
      {
        cta: {
          commands: [
            {
              command: 'stats ethprice',
              description: 'Get current ETH price',
            },
          ],
        },
      },
    );
  },
});
