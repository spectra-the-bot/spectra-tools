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

export const collectionCli = Cli.create('collection', {
  description: 'Query NFT collections.',
});

collectionCli.command('nfts', {
  description: 'List the NFTs in a collection.',
  args: z.object({
    id: z.string().describe('NFT collection identifier'),
    chain: chainOption,
  }),
  options: z.object({
    start: z.number().int().min(0).optional().default(0).describe('Integer offset for pagination'),
    limit: z.number().int().min(1).optional().default(20).describe('Number of NFTs to fetch'),
    ...paginationOptions.shape,
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { id: '0xcollection', chain: 'eth' },
      options: { start: 0, limit: 20, page: 1, pageSize: 10 },
      description: 'List NFTs in a collection on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = await client.get<unknown[]>('/v1/collection/nft_list', {
      id: c.args.id,
      chain_id: resolveChainId(c.args.chain),
      start: c.options.start,
      limit: c.options.limit,
    });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});
