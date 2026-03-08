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

export const gasCli = Cli.create('gas', {
  description: 'Query gas oracle data and estimate confirmation latency.',
});

interface GasOracle {
  LastBlock: string;
  SafeGasPrice: string;
  ProposeGasPrice: string;
  FastGasPrice: string;
  suggestBaseFee: string;
  gasUsedRatio: string;
}

gasCli.command('oracle', {
  description: 'Get current gas price recommendations.',
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    chain: z.string(),
    lastBlock: z.string(),
    slow: z.string(),
    standard: z.string(),
    fast: z.string(),
    baseFee: z.string(),
    gasUsedRatio: z.string(),
  }),
  examples: [{ options: { chain: 'abstract' }, description: 'Get gas oracle on Abstract' }],
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const oracle = await withRateLimit(
      () =>
        client.call<GasOracle>({
          chainid: chainId,
          module: 'gastracker',
          action: 'gasoracle',
        }),
      rateLimiter,
    );
    return c.ok(
      {
        chain: c.options.chain,
        lastBlock: oracle.LastBlock,
        slow: `${oracle.SafeGasPrice} Gwei`,
        standard: `${oracle.ProposeGasPrice} Gwei`,
        fast: `${oracle.FastGasPrice} Gwei`,
        baseFee: `${oracle.suggestBaseFee} Gwei`,
        gasUsedRatio: oracle.gasUsedRatio,
      },
      {
        cta: {
          commands: [
            {
              command: 'gas estimate',
              options: { gasprice: oracle.ProposeGasPrice },
              description: 'Estimate cost at standard gas price',
            },
          ],
        },
      },
    );
  },
});

gasCli.command('estimate', {
  description: 'Estimate confirmation time in seconds for a gas price (wei).',
  options: z.object({
    gasprice: z.string().describe('Gas price in wei'),
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    chain: z.string(),
    gasprice: z.string(),
    estimatedSeconds: z.string(),
  }),
  examples: [
    {
      options: { gasprice: '1000000000', chain: 'ethereum' },
      description: 'Estimate confirmation time at 1 gwei',
    },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const estimate = await withRateLimit(
      () =>
        client.call<string>({
          chainid: chainId,
          module: 'gastracker',
          action: 'gasestimate',
          gasprice: c.options.gasprice,
        }),
      rateLimiter,
    );
    return c.ok(
      {
        chain: c.options.chain,
        gasprice: c.options.gasprice,
        estimatedSeconds: estimate,
      },
      {
        cta: {
          commands: [
            {
              command: 'gas oracle',
              description: 'See current gas price recommendations',
            },
          ],
        },
      },
    );
  },
});
