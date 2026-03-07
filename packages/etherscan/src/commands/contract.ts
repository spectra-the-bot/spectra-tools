import {
  apiKeyAuth,
  checksumAddress,
  createRateLimiter,
  withRateLimit,
} from '@spectra-the-bot/cli-shared';
import { Cli, z } from 'incur';
import { createEtherscanClient } from '../api.js';
import { DEFAULT_CHAIN, resolveChainId } from '../chains.js';

const rateLimiter = createRateLimiter({ requestsPerSecond: 5 });

const chainOption = z
  .string()
  .default(DEFAULT_CHAIN)
  .describe('Chain name (abstract, ethereum, base, arbitrum, ...)');

export const contractCli = Cli.create('contract', {
  description: 'Query contract ABI, source code, and deployment info',
});

contractCli.command('abi', {
  description: 'Get the ABI for a verified contract',
  args: z.object({
    address: z.string().describe('Contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const abi = await withRateLimit(
      () =>
        client.call<string>({
          chainid: chainId,
          module: 'contract',
          action: 'getabi',
          address,
        }),
      rateLimiter,
    );
    return c.ok(
      { address, chain: c.options.chain, abi: JSON.parse(abi) as unknown[] },
      {
        cta: {
          commands: [
            {
              command: 'contract source',
              args: { address },
              description: 'Get verified source code',
            },
          ],
        },
      },
    );
  },
});

interface SourceResult {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
}

contractCli.command('source', {
  description: 'Get verified source code for a contract',
  args: z.object({
    address: z.string().describe('Contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const results = await withRateLimit(
      () =>
        client.call<SourceResult[]>({
          chainid: chainId,
          module: 'contract',
          action: 'getsourcecode',
          address,
        }),
      rateLimiter,
    );
    const result = results[0];
    if (!result) {
      return c.error({ code: 'NOT_FOUND', message: 'No source code found for this contract' });
    }
    return c.ok(
      {
        address,
        chain: c.options.chain,
        name: result.ContractName,
        compiler: result.CompilerVersion,
        optimized: result.OptimizationUsed === '1',
        runs: result.Runs,
        license: result.LicenseType,
        proxy: result.Proxy !== '0',
        implementation: result.Implementation || undefined,
        sourceCode: result.SourceCode,
        constructorArguments: result.ConstructorArguments,
      },
      {
        cta: {
          commands: [
            {
              command: 'contract abi',
              args: { address },
              description: 'Get the ABI',
            },
          ],
        },
      },
    );
  },
});

interface CreationResult {
  contractAddress: string;
  contractCreator: string;
  txHash: string;
}

contractCli.command('creation', {
  description: 'Get the creation transaction for a contract',
  args: z.object({
    address: z.string().describe('Contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const results = await withRateLimit(
      () =>
        client.call<CreationResult[]>({
          chainid: chainId,
          module: 'contract',
          action: 'getcontractcreation',
          contractaddresses: address,
        }),
      rateLimiter,
    );
    const result = results[0];
    if (!result) {
      return c.error({ code: 'NOT_FOUND', message: 'Contract creation info not found' });
    }
    return c.ok(
      {
        address: checksumAddress(result.contractAddress),
        creator: checksumAddress(result.contractCreator),
        txHash: result.txHash,
        chain: c.options.chain,
      },
      {
        cta: {
          commands: [
            {
              command: 'tx info',
              args: { txhash: result.txHash },
              description: 'Get the creation transaction details',
            },
          ],
        },
      },
    );
  },
});
