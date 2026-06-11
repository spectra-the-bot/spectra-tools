import { Cli, z } from 'incur';
import { createDebankClient } from '../api.js';
import { debankEnv } from '../auth.js';
import { COMMON_CHAINS, resolveChainId } from '../chains.js';
import { paginate, paginationOptions } from '../pagination.js';
import { paginatedOutput, tokenHistoryPriceSchema, tokenSchema } from '../schemas.js';

const chainOption = z
  .string()
  .describe(
    `DeBank chain id (e.g. ${COMMON_CHAINS.slice(0, 6).join(', ')}). Aliases like "ethereum" are accepted.`,
  );

export const tokenCli = Cli.create('token', {
  description: 'Query token metadata, top holders, and historical prices.',
});

tokenCli.command('info', {
  description: 'Get details for a token (contract address or native token id).',
  args: z.object({
    chain: chainOption,
    id: z.string().describe('Token contract address or native token id'),
  }),
  env: debankEnv,
  output: tokenSchema,
  examples: [
    {
      args: { chain: 'eth', id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
      description: 'Get USDC token info on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const data = await client.get<z.infer<typeof tokenSchema>>('/v1/token', {
      chain_id: resolveChainId(c.args.chain),
      id: c.args.id,
    });
    return c.ok(data);
  },
});

tokenCli.command('holders', {
  description: 'List the top holders of a token.',
  args: z.object({
    chain: chainOption,
    id: z.string().describe('Token contract address'),
  }),
  options: z.object({
    start: z.number().int().min(0).optional().default(0).describe('Integer offset for pagination'),
    limit: z.number().int().min(1).optional().default(100).describe('Number of holders to fetch'),
    ...paginationOptions.shape,
  }),
  env: debankEnv,
  output: paginatedOutput(
    z
      .tuple([
        z.string().describe('Holder wallet address'),
        z.number().describe('Token amount held (human-readable units)'),
      ])
      .describe('Holder entry: [address, amount], largest holders first'),
  ),
  examples: [
    {
      args: { chain: 'eth', id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
      options: { limit: 100, page: 1, pageSize: 10 },
      description: 'Top holders of USDC on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = await client.get<[string, number][]>('/v1/token/top_holders', {
      chain_id: resolveChainId(c.args.chain),
      id: c.args.id,
      start: c.options.start,
      limit: c.options.limit,
    });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});

tokenCli.command('history', {
  description: 'Get the historical price of a token on a given date.',
  args: z.object({
    chain: chainOption,
    id: z.string().describe('Token contract address or native token id'),
    date: z.string().describe('UTC date in YYYY-MM-DD format'),
  }),
  env: debankEnv,
  output: tokenHistoryPriceSchema,
  examples: [
    {
      args: {
        chain: 'eth',
        id: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        date: '2024-01-01',
      },
      description: 'USDC price on 2024-01-01',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const data = await client.get<z.infer<typeof tokenHistoryPriceSchema>>(
      '/v1/token/history_price',
      {
        chain_id: resolveChainId(c.args.chain),
        id: c.args.id,
        date_at: c.args.date,
      },
    );
    return c.ok(data);
  },
});

export const poolCli = Cli.create('pool', {
  description: 'Query liquidity pool details.',
});

poolCli.command('info', {
  description: 'Get detailed information about a specific liquidity pool.',
  args: z.object({
    id: z.string().describe('Pool identifier'),
    chain: chainOption,
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { id: '0x...', chain: 'eth' },
      description: 'Get pool stats by pool id on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const data = await client.get('/v1/pool', {
      id: c.args.id,
      chain_id: resolveChainId(c.args.chain),
    });
    return c.ok(data);
  },
});
