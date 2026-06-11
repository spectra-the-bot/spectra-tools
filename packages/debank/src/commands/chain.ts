import { Cli, z } from 'incur';
import { createDebankClient } from '../api.js';
import { debankEnv } from '../auth.js';
import { COMMON_CHAINS, resolveChainId } from '../chains.js';
import { paginate, paginationOptions } from '../pagination.js';

const chainOption = z
  .string()
  .describe(
    `DeBank chain id (e.g. ${COMMON_CHAINS.slice(0, 6).join(', ')}). Aliases like "ethereum" are accepted.`,
  );

export const chainCli = Cli.create('chain', {
  description: 'Query supported blockchains and their metadata.',
});

chainCli.command('info', {
  description: 'Get metadata for a single chain.',
  args: z.object({
    id: chainOption,
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { id: 'eth' },
      description: 'Get Ethereum chain info',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const id = resolveChainId(c.args.id);
    const data = await client.get('/v1/chain', { id });
    return c.ok(data);
  },
});

chainCli.command('list', {
  description: 'List all chains supported by DeBank.',
  options: paginationOptions,
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      options: { page: 1, pageSize: 10 },
      description: 'List the first 10 supported chains',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const data = await client.get<unknown[]>('/v1/chain/list');
    return c.ok(paginate(data, c.options.page, c.options.pageSize));
  },
});
