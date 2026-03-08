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

export const txCli = Cli.create('tx', {
  description: 'Query transaction details, receipts, and execution status.',
});

interface TransactionInfo {
  hash: string;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  nonce: string;
  blockNumber: string;
  blockHash: string;
  input: string;
}

txCli.command('info', {
  description: 'Get transaction details by hash.',
  args: z.object({
    txhash: z.string().describe('Transaction hash'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    hash: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    value: z.string(),
    gas: z.string(),
    gasPrice: z.string(),
    nonce: z.string(),
    block: z.string(),
    chain: z.string(),
  }),
  examples: [
    {
      args: { txhash: '0x1234...abcd' },
      options: { chain: 'abstract' },
      description: 'Inspect one transaction on Abstract',
    },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const tx = await withRateLimit(
      () =>
        client.callProxy<TransactionInfo>({
          chainid: chainId,
          module: 'proxy',
          action: 'eth_getTransactionByHash',
          txhash: c.args.txhash,
        }),
      rateLimiter,
    );
    return c.ok(
      {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce,
        block: tx.blockNumber,
        chain: c.options.chain,
      },
      {
        cta: {
          commands: [
            {
              command: 'tx receipt',
              args: { txhash: c.args.txhash },
              description: 'Get the transaction receipt',
            },
            {
              command: 'tx status',
              args: { txhash: c.args.txhash },
              description: 'Check execution status',
            },
          ],
        },
      },
    );
  },
});

interface TransactionReceipt {
  transactionHash: string;
  blockNumber: string;
  blockHash: string;
  from: string;
  to: string | null;
  status: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  contractAddress: string | null;
  logs: unknown[];
}

txCli.command('receipt', {
  description: 'Get the receipt for a transaction.',
  args: z.object({
    txhash: z.string().describe('Transaction hash'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    hash: z.string(),
    block: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    status: z.string(),
    gasUsed: z.string(),
    contractAddress: z.string().nullable(),
    logCount: z.number(),
    chain: z.string(),
  }),
  examples: [
    {
      args: { txhash: '0x1234...abcd' },
      options: { chain: 'ethereum' },
      description: 'Get receipt details including status and logs',
    },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const receipt = await withRateLimit(
      () =>
        client.callProxy<TransactionReceipt>({
          chainid: chainId,
          module: 'proxy',
          action: 'eth_getTransactionReceipt',
          txhash: c.args.txhash,
        }),
      rateLimiter,
    );
    return c.ok(
      {
        hash: receipt.transactionHash,
        block: receipt.blockNumber,
        from: receipt.from,
        to: receipt.to,
        status: receipt.status === '0x1' ? 'success' : 'failed',
        gasUsed: receipt.gasUsed,
        contractAddress: receipt.contractAddress,
        logCount: receipt.logs.length,
        chain: c.options.chain,
      },
      {
        cta: {
          commands: [
            {
              command: 'tx info',
              args: { txhash: c.args.txhash },
              description: 'Get full transaction details',
            },
          ],
        },
      },
    );
  },
});

interface TxStatus {
  status: string;
  errDescription: string;
}

txCli.command('status', {
  description: 'Check whether a transaction succeeded or failed.',
  args: z.object({
    txhash: z.string().describe('Transaction hash'),
  }),
  options: z.object({
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    hash: z.string(),
    status: z.string(),
    error: z.string().optional(),
    chain: z.string(),
  }),
  examples: [
    {
      args: { txhash: '0x1234...abcd' },
      options: { chain: 'base' },
      description: 'Get pass/fail status for a transaction',
    },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const result = await withRateLimit(
      () =>
        client.call<TxStatus>({
          chainid: chainId,
          module: 'transaction',
          action: 'gettxreceiptstatus',
          txhash: c.args.txhash,
        }),
      rateLimiter,
    );
    return c.ok(
      {
        hash: c.args.txhash,
        status: result.status === '1' ? 'success' : 'failed',
        error: result.errDescription || undefined,
        chain: c.options.chain,
      },
      {
        cta: {
          commands: [
            {
              command: 'tx receipt',
              args: { txhash: c.args.txhash },
              description: 'Get the full receipt',
            },
          ],
        },
      },
    );
  },
});
