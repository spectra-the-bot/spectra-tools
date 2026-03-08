import { apiKeyAuth, createRateLimiter, withRateLimit } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { createEtherscanClient } from '../api.js';
import { DEFAULT_CHAIN, resolveChainId } from '../chains.js';

const rateLimiter = createRateLimiter({ requestsPerSecond: 5 });

const chainOption = z
  .string()
  .default(DEFAULT_CHAIN)
  .describe('Chain name (abstract, ethereum, base, arbitrum, ...)');

const etherscanEnv = z.object({
  ETHERSCAN_API_KEY: z.string().optional().describe('Etherscan V2 API key'),
});

export const statsCli = Cli.create('stats', {
  description: 'Query ETH price and total supply statistics.',
});

const ethPriceSchema = z.object({
  ethbtc: z.string(),
  ethbtc_timestamp: z.string(),
  ethusd: z.string(),
  ethusd_timestamp: z.string(),
});

type EthPrice = z.infer<typeof ethPriceSchema>;

statsCli.command('ethprice', {
  description: 'Get latest ETH price in USD and BTC.',
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    chain: z.string(),
    usd: z.string(),
    btc: z.string(),
    usdTimestamp: z.string(),
    btcTimestamp: z.string(),
  }),
  examples: [{ options: { chain: 'ethereum' }, description: 'Get ETH spot price on Ethereum' }],
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const price = await withRateLimit(
      () =>
        client.call<EthPrice>(
          {
            chainid: chainId,
            module: 'stats',
            action: 'ethprice',
          },
          ethPriceSchema,
        ),
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
  description: 'Get total ETH supply in wei.',
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    chain: z.string(),
    totalSupplyWei: z.string(),
  }),
  examples: [{ options: { chain: 'ethereum' }, description: 'Get total ETH supply' }],
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const supply = await withRateLimit(
      () =>
        client.call<string>(
          {
            chainid: chainId,
            module: 'stats',
            action: 'ethsupply',
          },
          z.string(),
        ),
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
