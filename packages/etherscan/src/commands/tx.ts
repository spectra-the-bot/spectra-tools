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

export const txCli = Cli.create('tx', {
  description: 'Query transaction details, receipts, and execution status.',
});

const transactionInfoSchema = z.object({
  hash: z.string(),
  from: z.string(),
  to: z.string().nullable(),
  value: z.string(),
  gas: z.string(),
  gasPrice: z.string(),
  nonce: z.string(),
  blockNumber: z.string(),
  blockHash: z.string(),
  input: z.string(),
});

const transactionReceiptSchema = z.object({
  transactionHash: z.string(),
  blockNumber: z.string(),
  blockHash: z.string(),
  from: z.string(),
  to: z.string().nullable(),
  status: z.string(),
  gasUsed: z.string(),
  cumulativeGasUsed: z.string(),
  contractAddress: z.string().nullable(),
  logs: z.array(z.unknown()),
});

const txStatusSchema = z.object({
  isError: z.string(),
  errDescription: z.string(),
});

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
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const tx = await withRateLimit(
      () =>
        client.callProxy(
          {
            chainid: chainId,
            module: 'proxy',
            action: 'eth_getTransactionByHash',
            txhash: c.args.txhash,
          },
          transactionInfoSchema,
        ),
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
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
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
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const receipt = await withRateLimit(
      () =>
        client.callProxy(
          {
            chainid: chainId,
            module: 'proxy',
            action: 'eth_getTransactionReceipt',
            txhash: c.args.txhash,
          },
          transactionReceiptSchema,
        ),
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
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
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
    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);
    const result = await withRateLimit(
      () =>
        client.call(
          {
            chainid: chainId,
            module: 'transaction',
            action: 'getstatus',
            txhash: c.args.txhash,
          },
          txStatusSchema,
        ),
      rateLimiter,
    );
    return c.ok(
      {
        hash: c.args.txhash,
        status: result.isError === '0' ? 'success' : 'failed',
        error: result.errDescription || undefined,
        chain: c.options.chain,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
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
