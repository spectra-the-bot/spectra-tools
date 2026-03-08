import { checksumAddress, formatTimestamp, withRetry } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { readContract, writeContract } from 'viem/actions';
import { reputationRegistryAbi } from '../contracts/abis.js';
import {
  abstractMainnet,
  getPublicClient,
  getReputationRegistryAddress,
  getWalletClient,
} from '../contracts/client.js';

const reputation = Cli.create('reputation', {
  description: 'Manage ERC-8004 agent reputation and feedback.',
});

reputation.command('get', {
  description: 'Get the reputation score for an agent.',
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    REPUTATION_REGISTRY_ADDRESS: z
      .string()
      .optional()
      .describe('Reputation registry contract address'),
  }),
  output: z.object({
    agentId: z.string(),
    totalScore: z.string(),
    count: z.number(),
    averageScore: z.string(),
  }),
  examples: [{ args: { agentId: '1' }, description: 'Get reputation score for agent #1' }],
  async run(c) {
    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getReputationRegistryAddress(c.env);
    const tokenId = BigInt(c.args.agentId);

    const [totalScore, count] = await withRetry(
      () =>
        readContract(client, {
          address,
          abi: reputationRegistryAbi,
          functionName: 'getScore',
          args: [tokenId],
        }),
      { maxRetries: 3, baseMs: 500, maxMs: 5000 },
    );

    const countNum = Number(count);
    const avgScore = countNum > 0 ? (Number(totalScore) / countNum).toFixed(2) : '0.00';

    return c.ok({
      agentId: c.args.agentId,
      totalScore: totalScore.toString(),
      count: countNum,
      averageScore: avgScore,
    });
  },
});

reputation.command('feedback', {
  description: 'Submit feedback for an agent.',
  hint: 'Requires PRIVATE_KEY environment variable. Value is int128 (positive = good, negative = bad).',
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  options: z.object({
    value: z.coerce.number().describe('Feedback value (int128, positive or negative)'),
    tag1: z.string().optional().describe('Primary tag (e.g. "accuracy", "speed")'),
    tag2: z.string().optional().describe('Secondary tag'),
    fileUri: z.string().optional().describe('URI to a supporting file or report'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    REPUTATION_REGISTRY_ADDRESS: z
      .string()
      .optional()
      .describe('Reputation registry contract address'),
    PRIVATE_KEY: z.string().optional().describe('Private key for signing'),
  }),
  output: z.object({
    agentId: z.string(),
    value: z.number(),
    txHash: z.string(),
  }),
  examples: [
    {
      args: { agentId: '1' },
      options: { value: 10, tag1: 'accuracy', tag2: 'helpful' },
      description: 'Submit positive feedback',
    },
    {
      args: { agentId: '1' },
      options: { value: -5, tag1: 'accuracy' },
      description: 'Submit negative feedback',
    },
  ],
  async run(c) {
    const privateKey = c.env.PRIVATE_KEY;
    if (!privateKey) {
      return c.error({
        code: 'NO_PRIVATE_KEY',
        message: 'PRIVATE_KEY environment variable is required for write operations.',
        retryable: false,
      });
    }

    const walletClient = getWalletClient(privateKey, c.env.ABSTRACT_RPC_URL);
    const address = getReputationRegistryAddress(c.env);

    const hash = await writeContract(walletClient, {
      chain: abstractMainnet,
      address,
      abi: reputationRegistryAbi,
      functionName: 'submitFeedback',
      args: [
        BigInt(c.args.agentId),
        BigInt(c.options.value),
        c.options.tag1 ?? '',
        c.options.tag2 ?? '',
        c.options.fileUri ?? '',
      ],
    });

    return c.ok({ agentId: c.args.agentId, value: c.options.value, txHash: hash });
  },
});

reputation.command('history', {
  description: 'View feedback history for an agent.',
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  options: z.object({
    limit: z.coerce.number().default(50).describe('Maximum number of results'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    REPUTATION_REGISTRY_ADDRESS: z
      .string()
      .optional()
      .describe('Reputation registry contract address'),
  }),
  output: z.object({
    agentId: z.string(),
    history: z.array(
      z.object({
        index: z.number(),
        from: z.string(),
        value: z.number(),
        tag1: z.string(),
        tag2: z.string(),
        fileUri: z.string(),
        timestamp: z.string(),
      }),
    ),
    total: z.number(),
  }),
  examples: [
    { args: { agentId: '1' }, description: 'Show feedback history for agent #1' },
    { args: { agentId: '1' }, options: { limit: 10 }, description: 'Show last 10 feedbacks' },
  ],
  async run(c) {
    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getReputationRegistryAddress(c.env);
    const tokenId = BigInt(c.args.agentId);

    const count = await readContract(client, {
      address,
      abi: reputationRegistryAbi,
      functionName: 'getFeedbackCount',
      args: [tokenId],
    });

    const totalNum = Number(count);
    const fetchCount = Math.min(totalNum, c.options.limit);

    const history: {
      index: number;
      from: string;
      value: number;
      tag1: string;
      tag2: string;
      fileUri: string;
      timestamp: string;
    }[] = [];

    for (let i = totalNum - 1; i >= totalNum - fetchCount; i--) {
      const fb = await readContract(client, {
        address,
        abi: reputationRegistryAbi,
        functionName: 'getFeedbackAt',
        args: [tokenId, BigInt(i)],
      });

      history.push({
        index: i,
        from: checksumAddress(fb[0]),
        value: Number(fb[1]),
        tag1: fb[2],
        tag2: fb[3],
        fileUri: fb[4],
        timestamp: formatTimestamp(Number(fb[5])),
      });
    }

    return c.ok({ agentId: c.args.agentId, history, total: totalNum });
  },
});

export { reputation };
