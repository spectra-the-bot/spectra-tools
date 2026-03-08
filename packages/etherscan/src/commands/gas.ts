import { createRateLimiter, withRateLimit } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { createEtherscanClient } from '../api.js';
import { etherscanEnv } from '../auth.js';
import { DEFAULT_CHAIN, resolveChainId } from '../chains.js';

const rateLimiter = createRateLimiter({ requestsPerSecond: 5 });

const chainOption = z
  .string()
  .default(DEFAULT_CHAIN)
  .describe('Chain name (abstract, ethereum, base, arbitrum, ...)');

export const gasCli = Cli.create('gas', {
  description: 'Query gas oracle data and estimate confirmation latency.',
});

const gasOracleSchema = z.object({
  LastBlock: z.string(),
  SafeGasPrice: z.string(),
  ProposeGasPrice: z.string(),
  FastGasPrice: z.string(),
  suggestBaseFee: z.string(),
  gasUsedRatio: z.string(),
});

type GasOracle = z.infer<typeof gasOracleSchema>;

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
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const oracle = await withRateLimit(
      () =>
        client.call<GasOracle>(
          {
            chainid: chainId,
            module: 'gastracker',
            action: 'gasoracle',
          },
          gasOracleSchema,
        ),
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
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const estimate = await withRateLimit(
      () =>
        client.call<string>(
          {
            chainid: chainId,
            module: 'gastracker',
            action: 'gasestimate',
            gasprice: c.options.gasprice,
          },
          z.string(),
        ),
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
