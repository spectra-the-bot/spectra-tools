import {
  checksumAddress,
  createRateLimiter,
  formatTimestamp,
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
  .describe(
    'Chain name (default: abstract). Options: ethereum, base, arbitrum, optimism, polygon, ...',
  );

const topicOperatorOption = z.enum(['and', 'or']);

const logsItemSchema = z.object({
  address: z.string(),
  topics: z.array(z.string()),
  data: z.string(),
  blockNumber: z.string(),
  timeStamp: z.string(),
  gasPrice: z.string().optional(),
  gasUsed: z.string().optional(),
  logIndex: z.string(),
  transactionHash: z.string(),
  transactionIndex: z.string().optional(),
});

function normalizeAddress(address: string): string {
  try {
    return checksumAddress(address);
  } catch {
    return address;
  }
}

export const logsCli = Cli.create('logs', {
  description: 'Query event logs with topic, address, and block-range filters.',
});

logsCli.command('get', {
  description: 'Get event logs from Etherscan logs.getLogs.',
  args: z.object({}),
  options: z.object({
    fromblock: z.string().optional().default('0').describe('Start block number'),
    toblock: z.string().optional().default('latest').describe('End block number'),
    address: z.string().optional().describe('Filter by contract address'),
    topic0: z.string().optional().describe('First indexed topic'),
    topic1: z.string().optional().describe('Second indexed topic'),
    topic2: z.string().optional().describe('Third indexed topic'),
    topic3: z.string().optional().describe('Fourth indexed topic'),
    topic0_1_opr: topicOperatorOption.optional().describe('Operator between topic0 and topic1'),
    topic1_2_opr: topicOperatorOption.optional().describe('Operator between topic1 and topic2'),
    topic2_3_opr: topicOperatorOption.optional().describe('Operator between topic2 and topic3'),
    page: z.number().optional().default(1).describe('Page number'),
    offset: z.number().optional().default(100).describe('Results per page'),
    chain: chainOption,
  }),
  env: etherscanEnv,
  output: z.object({
    chain: z.string(),
    fromBlock: z.string(),
    toBlock: z.string(),
    address: z.string().optional(),
    count: z.number(),
    logs: z.array(
      z.object({
        address: z.string(),
        topics: z.array(z.string()),
        data: z.string(),
        block: z.string(),
        timestamp: z.string(),
        transactionHash: z.string(),
        logIndex: z.string(),
        transactionIndex: z.string().optional(),
        gasPrice: z.string().optional(),
        gasUsed: z.string().optional(),
      }),
    ),
  }),
  examples: [
    {
      args: {},
      options: {
        chain: 'ethereum',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        topic0: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55aebec6f6f3c',
        fromblock: '20000000',
        toblock: 'latest',
        offset: 25,
      },
      description: 'Query ERC-20 Transfer logs for USDC',
    },
  ],
  async run(c) {
    if (c.options.address && !isAddress(c.options.address)) {
      return c.error({
        code: 'INVALID_ADDRESS',
        message: `Invalid contract address: "${c.options.address}". Use a valid 0x-prefixed 20-byte hex address.`,
      });
    }

    const apiKey = c.env.ETHERSCAN_API_KEY;
    const chainId = resolveChainId(c.options.chain);
    const client = createEtherscanClient(apiKey);

    const logs = await withRateLimit(
      () =>
        client.call(
          {
            chainid: chainId,
            module: 'logs',
            action: 'getLogs',
            fromBlock: c.options.fromblock,
            toBlock: c.options.toblock,
            address: c.options.address ? normalizeAddress(c.options.address) : undefined,
            topic0: c.options.topic0,
            topic1: c.options.topic1,
            topic2: c.options.topic2,
            topic3: c.options.topic3,
            topic0_1_opr: c.options.topic0_1_opr,
            topic1_2_opr: c.options.topic1_2_opr,
            topic2_3_opr: c.options.topic2_3_opr,
            page: c.options.page,
            offset: c.options.offset,
          },
          z.array(logsItemSchema),
        ),
      rateLimiter,
    );

    const formatted = logs.map((log) => ({
      address: normalizeAddress(log.address),
      topics: log.topics,
      data: log.data,
      block: log.blockNumber,
      timestamp: formatTimestamp(Number(log.timeStamp)),
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
      transactionIndex: log.transactionIndex,
      gasPrice: log.gasPrice,
      gasUsed: log.gasUsed,
    }));

    return c.ok({
      chain: c.options.chain,
      fromBlock: c.options.fromblock,
      toBlock: c.options.toblock,
      address: c.options.address ? normalizeAddress(c.options.address) : undefined,
      count: formatted.length,
      logs: formatted,
    });
  },
});
