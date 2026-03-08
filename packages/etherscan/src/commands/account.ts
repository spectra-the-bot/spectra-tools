import {
  checksumAddress,
  createRateLimiter,
  formatTimestamp,
  weiToEth,
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

const txListItemSchema = z.object({
  hash: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
  timeStamp: z.string(),
  blockNumber: z.string(),
  isError: z.string(),
  gasUsed: z.string(),
});

const tokenTxItemSchema = z.object({
  hash: z.string(),
  from: z.string(),
  to: z.string(),
  value: z.string(),
  tokenName: z.string(),
  tokenSymbol: z.string(),
  tokenDecimal: z.string(),
  timeStamp: z.string(),
  contractAddress: z.string(),
});

function normalizeAddress(address: string): string {
  try {
    return checksumAddress(address);
  } catch {
    return address;
  }
}

export const accountCli = Cli.create('account', {
  description: 'Query account balances, transactions, and token transfers.',
});

accountCli.command('balance', {
  description: 'Get the native-token balance of an address.',
  args: z.object({
    address: z.string().describe('Wallet address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    address: z.string(),
    wei: z.string(),
    eth: z.string(),
    chain: z.string(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { chain: 'abstract' },
      description: 'Get ETH balance on Abstract',
    },
  ],
  async run(c) {
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = normalizeAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const wei = await withRateLimit(
      () =>
        client.call<string>(
          {
            chainid: chainId,
            module: 'account',
            action: 'balance',
            address,
            tag: 'latest',
          },
          z.string(),
        ),
      rateLimiter,
    );
    return c.ok(
      { address, wei, eth: weiToEth(wei), chain: c.options.chain },
      {
        cta: {
          commands: [
            { command: 'account txlist', args: { address }, description: 'List transactions' },
            {
              command: 'account tokentx',
              args: { address },
              description: 'List token transfers',
            },
          ],
        },
      },
    );
  },
});

accountCli.command('txlist', {
  description: 'List normal transactions for an address.',
  args: z.object({
    address: z.string().describe('Wallet address'),
  }),
  options: z.object({
    startblock: z.number().optional().default(0).describe('Start block number'),
    endblock: z.string().optional().default('latest').describe('End block number'),
    page: z.number().optional().default(1).describe('Page number'),
    offset: z.number().optional().default(10).describe('Number of results per page'),
    sort: z.string().optional().default('asc').describe('Sort order (asc or desc)'),
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    address: z.string(),
    chain: z.string(),
    count: z.number(),
    transactions: z.array(
      z.object({
        hash: z.string(),
        from: z.string(),
        to: z.string(),
        value: z.string(),
        eth: z.string(),
        timestamp: z.string(),
        block: z.string(),
        status: z.string(),
        gasUsed: z.string(),
      }),
    ),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { chain: 'ethereum', sort: 'desc', offset: 5 },
      description: 'List most recent transactions for an address',
    },
  ],
  async run(c) {
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = normalizeAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const txs = await withRateLimit(
      () =>
        client.call(
          {
            chainid: chainId,
            module: 'account',
            action: 'txlist',
            address,
            startblock: c.options.startblock,
            endblock: c.options.endblock,
            page: c.options.page,
            offset: c.options.offset,
            sort: c.options.sort,
          },
          z.array(txListItemSchema),
        ),
      rateLimiter,
    );
    const formatted = txs.map((tx) => ({
      hash: tx.hash,
      from: normalizeAddress(tx.from),
      to: tx.to ? normalizeAddress(tx.to) : '',
      value: tx.value,
      eth: weiToEth(tx.value),
      timestamp: formatTimestamp(Number(tx.timeStamp)),
      block: tx.blockNumber,
      status: tx.isError === '0' ? 'success' : 'failed',
      gasUsed: tx.gasUsed,
    }));
    const firstHash = formatted[0]?.hash;
    return c.ok(
      { address, chain: c.options.chain, count: formatted.length, transactions: formatted },
      {
        cta: {
          commands: firstHash
            ? [
                {
                  command: 'tx info',
                  args: { txhash: firstHash },
                  description: 'Get details for the first transaction',
                },
              ]
            : [],
        },
      },
    );
  },
});

accountCli.command('tokentx', {
  description: 'List ERC-20 token transfers for an address.',
  args: z.object({
    address: z.string().describe('Wallet address'),
  }),
  options: z.object({
    contractaddress: z.string().optional().describe('Filter by token contract address'),
    page: z.number().optional().default(1).describe('Page number'),
    offset: z.number().optional().default(20).describe('Results per page'),
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    address: z.string(),
    chain: z.string(),
    count: z.number(),
    transfers: z.array(
      z.object({
        hash: z.string(),
        from: z.string(),
        to: z.string(),
        value: z.string(),
        token: z.string(),
        tokenName: z.string(),
        decimals: z.string(),
        timestamp: z.string(),
        contract: z.string(),
      }),
    ),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { chain: 'base', offset: 10 },
      description: 'List recent ERC-20 transfers for an address',
    },
  ],
  async run(c) {
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = normalizeAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const transfers = await withRateLimit(
      () =>
        client.call(
          {
            chainid: chainId,
            module: 'account',
            action: 'tokentx',
            address,
            contractaddress: c.options.contractaddress,
            page: c.options.page,
            offset: c.options.offset,
          },
          z.array(tokenTxItemSchema),
        ),
      rateLimiter,
    );
    const formatted = transfers.map((tx) => ({
      hash: tx.hash,
      from: normalizeAddress(tx.from),
      to: normalizeAddress(tx.to),
      value: tx.value,
      token: tx.tokenSymbol,
      tokenName: tx.tokenName,
      decimals: tx.tokenDecimal,
      timestamp: formatTimestamp(Number(tx.timeStamp)),
      contract: normalizeAddress(tx.contractAddress),
    }));
    return c.ok(
      { address, chain: c.options.chain, count: formatted.length, transfers: formatted },
      {
        cta: {
          commands: [
            {
              command: 'account balance',
              args: { address },
              description: 'Check ETH balance',
            },
          ],
        },
      },
    );
  },
});

accountCli.command('tokenbalance', {
  description: 'Get ERC-20 token balance for an address.',
  args: z.object({
    address: z.string().describe('Wallet address'),
  }),
  options: z.object({
    contractaddress: z.string().describe('Token contract address'),
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    address: z.string(),
    contract: z.string(),
    balance: z.string(),
    chain: z.string(),
  }),
  examples: [
    {
      args: { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
      options: { contractaddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'ethereum' },
      description: 'Get token balance for a wallet + token pair',
    },
  ],
  async run(c) {
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const address = normalizeAddress(c.args.address);
    const contract = normalizeAddress(c.options.contractaddress);
    const client = createEtherscanClient(apiKey);
    const balance = await withRateLimit(
      () =>
        client.call<string>(
          {
            chainid: chainId,
            module: 'account',
            action: 'tokenbalance',
            address,
            contractaddress: contract,
            tag: 'latest',
          },
          z.string(),
        ),
      rateLimiter,
    );
    return c.ok(
      { address, contract, balance, chain: c.options.chain },
      {
        cta: {
          commands: [
            {
              command: 'token info',
              args: { contractaddress: contract },
              description: 'Get token info',
            },
          ],
        },
      },
    );
  },
});
