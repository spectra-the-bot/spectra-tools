import { Cli, z } from 'incur';
import { createDebankClient } from '../api.js';
import { debankEnv } from '../auth.js';
import { COMMON_CHAINS, resolveChainId } from '../chains.js';
import { paginate, paginationOptions } from '../pagination.js';
import { paginatedOutput, protocolSchema } from '../schemas.js';

const chainOption = z
  .string()
  .describe(
    `DeBank chain id (e.g. ${COMMON_CHAINS.slice(0, 6).join(', ')}). Aliases like "ethereum" are accepted.`,
  );

export const protocolCli = Cli.create('protocol', {
  description: 'Query DeFi protocol metadata, listings, and top holders.',
});

protocolCli.command('info', {
  description: 'Get details for a specific protocol.',
  args: z.object({
    id: z.string().describe('Protocol identifier (e.g. curve, uniswap3)'),
  }),
  env: debankEnv,
  output: protocolSchema,
  examples: [
    {
      args: { id: 'curve' },
      description: 'Get info for the Curve protocol',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const data = await client.get<z.infer<typeof protocolSchema>>('/v1/protocol', {
      id: c.args.id,
    });
    return c.ok(data);
  },
});

protocolCli.command('list', {
  description: 'List protocols on a chain, sorted by TVL (descending).',
  args: z.object({
    chain: chainOption,
  }),
  options: paginationOptions,
  env: debankEnv,
  output: paginatedOutput(protocolSchema),
  examples: [
    {
      args: { chain: 'eth' },
      options: { page: 1, pageSize: 10 },
      description: 'Top 10 protocols on Ethereum by TVL',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const chainId = resolveChainId(c.args.chain);
    const protocols = await client.get<z.infer<typeof protocolSchema>[]>('/v1/protocol/list', {
      chain_id: chainId,
    });
    const sorted = [...protocols].sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));
    return c.ok(paginate(sorted, c.options.page, c.options.pageSize));
  },
});

protocolCli.command('holders', {
  description: 'Get the top holders of a protocol.',
  args: z.object({
    id: z.string().describe('Protocol identifier (e.g. curve, uniswap3)'),
  }),
  options: z.object({
    start: z.number().int().min(0).optional().describe('Integer offset for pagination'),
    limit: z.number().int().min(1).optional().default(10).describe('Number of results to return'),
    ...paginationOptions.shape,
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { id: 'curve' },
      options: { limit: 20, page: 1, pageSize: 10 },
      description: 'Top holders of the Curve protocol',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = await client.get<unknown[]>('/v1/protocol/top_holders', {
      id: c.args.id,
      start: c.options.start,
      limit: c.options.limit,
    });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});
