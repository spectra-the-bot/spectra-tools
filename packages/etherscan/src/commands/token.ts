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

export const tokenCli = Cli.create('token', {
  description: 'Query token metadata, holders, and supply.',
});

const tokenInfoSchema = z.object({
  contractAddress: z.string(),
  tokenName: z.string(),
  symbol: z.string(),
  divisor: z.string(),
  tokenType: z.string(),
  totalSupply: z.string(),
  blueCheckmark: z.string(),
  description: z.string(),
  website: z.string(),
  email: z.string(),
  blog: z.string(),
  reddit: z.string(),
  slack: z.string(),
  facebook: z.string(),
  twitter: z.string(),
  bitcointalk: z.string(),
  github: z.string(),
  telegram: z.string(),
  wechat: z.string(),
  linkedin: z.string(),
  discord: z.string(),
  whitepaper: z.string(),
  tokenPriceUSD: z.string(),
});

const holderEntrySchema = z.object({
  TokenHolderAddress: z.string(),
  TokenHolderQuantity: z.string(),
});

tokenCli.command('info', {
  description: 'Get metadata for a token contract.',
  args: z.object({
    contractaddress: z.string().describe('Token contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    address: z.string(),
    chain: z.string(),
    name: z.string(),
    symbol: z.string(),
    type: z.string(),
    totalSupply: z.string(),
    decimals: z.string(),
    priceUsd: z.string().optional(),
    website: z.string().optional(),
    description: z.string().optional(),
  }),
  examples: [
    {
      args: { contractaddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      options: { chain: 'ethereum' },
      description: 'Get token metadata for USDC',
    },
  ],
  async run(c) {
    if (!isAddress(c.args.contractaddress)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid contract address: "${c.args.contractaddress}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.contractaddress);
    const client = createEtherscanClient(apiKey);
    const results = await withRateLimit(
      () =>
        client.call(
          {
            chainid: chainId,
            module: 'token',
            action: 'tokeninfo',
            contractaddress: address,
          },
          z.array(tokenInfoSchema),
        ),
      rateLimiter,
    );
    const info = results[0];
    if (!info) {
      return c.error({ code: 'NOT_FOUND', message: 'Token info not found' });
    }
    return c.ok(
      {
        address,
        chain: c.options.chain,
        name: info.tokenName,
        symbol: info.symbol,
        type: info.tokenType,
        totalSupply: info.totalSupply,
        decimals: info.divisor,
        priceUsd: info.tokenPriceUSD || undefined,
        website: info.website || undefined,
        description: info.description || undefined,
      },
      {
        cta: {
          commands: [
            {
              command: 'token supply',
              args: { contractaddress: address },
              description: 'Get circulating supply',
            },
            {
              command: 'token holders',
              args: { contractaddress: address },
              description: 'List top holders',
            },
          ],
        },
      },
    );
  },
});

tokenCli.command('holders', {
  description: 'List top token holders.',
  args: z.object({
    contractaddress: z.string().describe('Token contract address'),
  }),
  options: z.object({
    page: z.number().optional().default(1).describe('Page number'),
    offset: z.number().optional().default(10).describe('Results per page'),
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    contractAddress: z.string(),
    chain: z.string(),
    count: z.number(),
    holders: z.array(
      z.object({
        rank: z.number(),
        address: z.string(),
        quantity: z.string(),
      }),
    ),
  }),
  examples: [
    {
      args: { contractaddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      options: { page: 1, offset: 20, chain: 'ethereum' },
      description: 'List top 20 holders for a token',
    },
  ],
  async run(c) {
    if (!isAddress(c.args.contractaddress)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid contract address: "${c.args.contractaddress}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.contractaddress);
    const client = createEtherscanClient(apiKey);
    const holders = await withRateLimit(
      () =>
        client.call(
          {
            chainid: chainId,
            module: 'token',
            action: 'tokenholderlist',
            contractaddress: address,
            page: c.options.page,
            offset: c.options.offset,
          },
          z.array(holderEntrySchema),
        ),
      rateLimiter,
    );
    const formatted = holders.map((h, i) => ({
      rank: (c.options.page - 1) * c.options.offset + i + 1,
      address: checksumAddress(h.TokenHolderAddress),
      quantity: h.TokenHolderQuantity,
    }));
    return c.ok(
      {
        contractAddress: address,
        chain: c.options.chain,
        count: formatted.length,
        holders: formatted,
      },
      {
        cta: {
          commands: [
            {
              command: 'token info',
              args: { contractaddress: address },
              description: 'Get token details',
            },
          ],
        },
      },
    );
  },
});

tokenCli.command('supply', {
  description: 'Get total token supply.',
  args: z.object({
    contractaddress: z.string().describe('Token contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    contractAddress: z.string(),
    chain: z.string(),
    totalSupply: z.string(),
  }),
  examples: [
    {
      args: { contractaddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
      options: { chain: 'ethereum' },
      description: 'Get total supply for a token',
    },
  ],
  async run(c) {
    if (!isAddress(c.args.contractaddress)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid contract address: "${c.args.contractaddress}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.contractaddress);
    const client = createEtherscanClient(apiKey);
    const supply = await withRateLimit(
      () =>
        client.call<string>(
          {
            chainid: chainId,
            module: 'stats',
            action: 'tokensupply',
            contractaddress: address,
          },
          z.string(),
        ),
      rateLimiter,
    );
    return c.ok(
      { contractAddress: address, chain: c.options.chain, totalSupply: supply },
      {
        cta: {
          commands: [
            {
              command: 'token info',
              args: { contractaddress: address },
              description: 'Get full token info',
            },
          ],
        },
      },
    );
  },
});
