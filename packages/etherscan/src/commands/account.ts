import {
  apiKeyAuth,
  checksumAddress,
  createRateLimiter,
  formatTimestamp,
  weiToEth,
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

export const accountCli = Cli.create('account', {
  description: 'Query account balances, transactions, and token transfers',
});

accountCli.command('balance', {
  description: 'Get the ETH balance of an address',
  args: z.object({
    address: z.string().describe('Ethereum address'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const wei = await withRateLimit(
      () =>
        client.call<string>({
          chainid: chainId,
          module: 'account',
          action: 'balance',
          address,
          tag: 'latest',
        }),
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

interface TxListItem {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  blockNumber: string;
  isError: string;
  gasUsed: string;
}

accountCli.command('txlist', {
  description: 'List normal transactions for an address',
  args: z.object({
    address: z.string().describe('Ethereum address'),
  }),
  options: z.object({
    startblock: z.number().optional().default(0).describe('Start block number'),
    endblock: z.string().optional().default('latest').describe('End block number'),
    page: z.number().optional().default(1).describe('Page number'),
    offset: z.number().optional().default(10).describe('Number of results per page'),
    sort: z.string().optional().default('asc').describe('Sort order (asc or desc)'),
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const txs = await withRateLimit(
      () =>
        client.call<TxListItem[]>({
          chainid: chainId,
          module: 'account',
          action: 'txlist',
          address,
          startblock: c.options.startblock,
          endblock: c.options.endblock,
          page: c.options.page,
          offset: c.options.offset,
          sort: c.options.sort,
        }),
      rateLimiter,
    );
    const formatted = txs.map((tx) => ({
      hash: tx.hash,
      from: checksumAddress(tx.from),
      to: tx.to ? checksumAddress(tx.to) : '',
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

interface TokenTxItem {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  timeStamp: string;
  contractAddress: string;
}

accountCli.command('tokentx', {
  description: 'List ERC-20 token transfers for an address',
  args: z.object({
    address: z.string().describe('Ethereum address'),
  }),
  options: z.object({
    contractaddress: z.string().optional().describe('Filter by token contract address'),
    page: z.number().optional().default(1).describe('Page number'),
    offset: z.number().optional().default(20).describe('Results per page'),
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const client = createEtherscanClient(apiKey);
    const transfers = await withRateLimit(
      () =>
        client.call<TokenTxItem[]>({
          chainid: chainId,
          module: 'account',
          action: 'tokentx',
          address,
          contractaddress: c.options.contractaddress,
          page: c.options.page,
          offset: c.options.offset,
        }),
      rateLimiter,
    );
    const formatted = transfers.map((tx) => ({
      hash: tx.hash,
      from: checksumAddress(tx.from),
      to: checksumAddress(tx.to),
      value: tx.value,
      token: tx.tokenSymbol,
      tokenName: tx.tokenName,
      decimals: tx.tokenDecimal,
      timestamp: formatTimestamp(Number(tx.timeStamp)),
      contract: checksumAddress(tx.contractAddress),
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
  description: 'Get ERC-20 token balance for an address',
  args: z.object({
    address: z.string().describe('Ethereum address'),
  }),
  options: z.object({
    contractaddress: z.string().describe('Token contract address'),
    chain: chainOption,
  }),
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const address = checksumAddress(c.args.address);
    const contract = checksumAddress(c.options.contractaddress);
    const client = createEtherscanClient(apiKey);
    const balance = await withRateLimit(
      () =>
        client.call<string>({
          chainid: chainId,
          module: 'account',
          action: 'tokenbalance',
          address,
          contractaddress: contract,
          tag: 'latest',
        }),
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
