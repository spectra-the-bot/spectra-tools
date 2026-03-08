import {
  apiKeyAuth,
  checksumAddress,
  createRateLimiter,
  withRateLimit,
} from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { createEtherscanClient } from '../api.js';
import { DEFAULT_CHAIN, resolveChainId } from '../chains.js';

const rateLimiter = createRateLimiter({ requestsPerSecond: 5 });

const chainOption = z
  .string()
  .default(DEFAULT_CHAIN)
  .describe('Chain name (abstract, ethereum, base, arbitrum, ...)');

export const tokenCli = Cli.create('token', {
  description: 'Query token info, holders, and supply',
});

interface TokenInfo {
  contractAddress: string;
  tokenName: string;
  symbol: string;
  divisor: string;
  tokenType: string;
  totalSupply: string;
  blueCheckmark: string;
  description: string;
  website: string;
  email: string;
  blog: string;
  reddit: string;
  slack: string;
  facebook: string;
  twitter: string;
  bitcointalk: string;
  github: string;
  telegram: string;
  wechat: string;
  linkedin: string;
  discord: string;
  whitepaper: string;
  tokenPriceUSD: string;
}

tokenCli.command('info', {
  description: 'Get information about a token contract',
  args: z.object({
    contractaddress: z.string().describe('Token contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.contractaddress);
    const client = createEtherscanClient(apiKey);
    const results = await withRateLimit(
      () =>
        client.call<TokenInfo[]>({
          chainid: chainId,
          module: 'token',
          action: 'tokeninfo',
          contractaddress: address,
        }),
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

interface HolderEntry {
  TokenHolderAddress: string;
  TokenHolderQuantity: string;
}

tokenCli.command('holders', {
  description: 'List top token holders',
  args: z.object({
    contractaddress: z.string().describe('Token contract address'),
  }),
  options: z.object({
    page: z.number().optional().default(1).describe('Page number'),
    offset: z.number().optional().default(10).describe('Results per page'),
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.contractaddress);
    const client = createEtherscanClient(apiKey);
    const holders = await withRateLimit(
      () =>
        client.call<HolderEntry[]>({
          chainid: chainId,
          module: 'token',
          action: 'tokenholderlist',
          contractaddress: address,
          page: c.options.page,
          offset: c.options.offset,
        }),
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
  description: 'Get the total supply of a token',
  args: z.object({
    contractaddress: z.string().describe('Token contract address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.contractaddress);
    const client = createEtherscanClient(apiKey);
    const supply = await withRateLimit(
      () =>
        client.call<string>({
          chainid: chainId,
          module: 'stats',
          action: 'tokensupply',
          contractaddress: address,
        }),
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
