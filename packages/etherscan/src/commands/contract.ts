import {
  checksumAddress,
  createRateLimiter,
  isAddress,
  withRateLimit,
} from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { createEtherscanClient } from '../api.js';
import { etherscanEnv } from '../auth.js';
import { DEFAULT_CHAIN, resolveChainId } from '../chains.js';

const rateLimiter = createRateLimiter({ requestsPerSecond: 5 });

const chainOption = z
  .string()
  .default(DEFAULT_CHAIN)
  .describe('Chain name (abstract, ethereum, base, arbitrum, ...)');

export const contractCli = Cli.create('contract', {
  description: 'Query contract ABI, source code, and deployment metadata.',
});

const sourceResultSchema = z.object({
  SourceCode: z.string(),
  ABI: z.string(),
  ContractName: z.string(),
  CompilerVersion: z.string(),
  OptimizationUsed: z.string(),
  Runs: z.string(),
  ConstructorArguments: z.string(),
  LicenseType: z.string(),
  Proxy: z.string(),
  Implementation: z.string(),
});

const creationResultSchema = z.object({
  contractAddress: z.string(),
  contractCreator: z.string(),
  txHash: z.string(),
});

contractCli.command('abi', {
  description: 'Get the ABI for a verified contract.',
  args: z.object({
    address: z.string().describe('Contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    address: z.string(),
    chain: z.string(),
    abi: z.array(z.unknown()),
  }),
  examples: [
    {
      args: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      options: { chain: 'ethereum' },
      description: 'Fetch ABI for a verified ERC-20 contract',
    },
  ],
  async run(c) {
    if (!isAddress(c.args.address)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid address: "${c.args.address}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const abi = await withRateLimit(
      () =>
        client.call<string>(
          {
            chainid: chainId,
            module: 'contract',
            action: 'getabi',
            address,
          },
          z.string(),
        ),
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

contractCli.command('source', {
  description: 'Get verified source code for a contract.',
  args: z.object({
    address: z.string().describe('Contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    address: z.string(),
    chain: z.string(),
    name: z.string(),
    compiler: z.string(),
    optimized: z.boolean(),
    runs: z.string(),
    license: z.string(),
    proxy: z.boolean(),
    implementation: z.string().optional(),
    sourceCode: z.string(),
    constructorArguments: z.string(),
  }),
  examples: [
    {
      args: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      options: { chain: 'ethereum' },
      description: 'Fetch verified source code metadata',
    },
  ],
  async run(c) {
    if (!isAddress(c.args.address)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid address: "${c.args.address}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const results = await withRateLimit(
      () =>
        client.call(
          {
            chainid: chainId,
            module: 'contract',
            action: 'getsourcecode',
            address,
          },
          z.array(sourceResultSchema),
        ),
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

contractCli.command('creation', {
  description: 'Get the deployment transaction and creator for a contract.',
  args: z.object({
    address: z.string().describe('Contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    address: z.string(),
    creator: z.string(),
    txHash: z.string(),
    chain: z.string(),
  }),
  examples: [
    {
      args: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      options: { chain: 'ethereum' },
      description: 'Find deployment tx for a contract',
    },
  ],
  async run(c) {
    if (!isAddress(c.args.address)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid address: "${c.args.address}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const results = await withRateLimit(
      () =>
        client.call(
          {
            chainid: chainId,
            module: 'contract',
            action: 'getcontractcreation',
            contractaddresses: address,
          },
          z.array(creationResultSchema),
        ),
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
