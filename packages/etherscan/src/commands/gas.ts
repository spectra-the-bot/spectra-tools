import { Cli, z } from 'incur';
import { apiKeyAuth, createRateLimiter, withRateLimit } from '@spectra-the-bot/cli-shared';
import { createEtherscanClient } from '../api.js';
import { resolveChainId, DEFAULT_CHAIN } from '../chains.js';

const rateLimiter = createRateLimiter({ requestsPerSecond: 5 });

const chainOption = z
  .string()
  .default(DEFAULT_CHAIN)
  .describe('Chain name (abstract, ethereum, base, arbitrum, ...)');

export const gasCli = Cli.create('gas', {
  description: 'Query gas oracle and estimate gas costs',
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
  description: 'Get current gas price recommendations',
  options: z.object({
    chain: chainOption,
  }),
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
  description: 'Estimate gas cost in wei for a given gas price',
  options: z.object({
    gasprice: z.string().describe('Gas price in wei'),
    chain: chainOption,
  }),
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
