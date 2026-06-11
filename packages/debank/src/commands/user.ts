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

const addressArg = z.object({
  address: z.string().describe('User wallet address (0x...)'),
});

function resolveChainIds(chainIds?: string): string | undefined {
  if (!chainIds) return undefined;
  return chainIds
    .split(',')
    .map((c) => resolveChainId(c))
    .join(',');
}

export const userCli = Cli.create('user', {
  description: "Query a wallet's balances, tokens, NFTs, positions, history, and authorizations.",
});

// ---- Balances ---------------------------------------------------------------

userCli.command('balance', {
  description: "Get a wallet's total USD balance (optionally for specific chains).",
  args: addressArg,
  options: z.object({
    chain: chainOption.optional().describe('Single chain to scope the balance to'),
    chains: z.string().optional().describe('Comma-separated chain ids to include'),
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { address: '0x1234000000000000000000000000000000000000' },
      description: 'Total net worth across all chains',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    if (c.options.chain) {
      const data = await client.get('/v1/user/chain_balance', {
        id: c.args.address,
        chain_id: resolveChainId(c.options.chain),
      });
      return c.ok(data);
    }
    const data = await client.get('/v1/user/total_balance', {
      id: c.args.address,
      chain_ids: resolveChainIds(c.options.chains),
    });
    return c.ok(data);
  },
});

// ---- Tokens -----------------------------------------------------------------

userCli.command('tokens', {
  description: "List a wallet's token balances.",
  args: addressArg,
  options: z.object({
    chain: chainOption.optional().describe('Single chain to scope the query to'),
    chains: z.string().optional().describe('Comma-separated chain ids (all-chain query)'),
    ...paginationOptions.shape,
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { address: '0x1234000000000000000000000000000000000000' },
      options: { chain: 'eth', page: 1, pageSize: 10 },
      description: 'Token balances on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = c.options.chain
      ? await client.get<unknown[]>('/v1/user/token_list', {
          id: c.args.address,
          chain_id: resolveChainId(c.options.chain),
        })
      : await client.get<unknown[]>('/v1/user/all_token_list', {
          id: c.args.address,
          chain_ids: resolveChainIds(c.options.chains),
        });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});

userCli.command('token', {
  description: "Get a wallet's balance for a single token.",
  args: z.object({
    address: z.string().describe('User wallet address (0x...)'),
    chain: chainOption,
    token: z.string().describe('Token contract address or native token id'),
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: {
        address: '0x1234000000000000000000000000000000000000',
        chain: 'eth',
        token: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      },
      description: 'USDC balance for a wallet',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const data = await client.get('/v1/user/token_balance', {
      id: c.args.address,
      chain_id: resolveChainId(c.args.chain),
      token_id: c.args.token,
    });
    return c.ok(data);
  },
});

// ---- NFTs -------------------------------------------------------------------

userCli.command('nfts', {
  description: "List a wallet's NFTs.",
  args: addressArg,
  options: z.object({
    chain: chainOption.optional().describe('Single chain to scope the query to'),
    chains: z.string().optional().describe('Comma-separated chain ids (all-chain query)'),
    ...paginationOptions.shape,
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { address: '0x1234000000000000000000000000000000000000' },
      options: { chain: 'eth', page: 1, pageSize: 10 },
      description: 'NFTs held on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = c.options.chain
      ? await client.get<unknown[]>('/v1/user/nft_list', {
          id: c.args.address,
          chain_id: resolveChainId(c.options.chain),
        })
      : await client.get<unknown[]>('/v1/user/all_nft_list', {
          id: c.args.address,
          chain_ids: resolveChainIds(c.options.chains),
        });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});

// ---- Used chains ------------------------------------------------------------

userCli.command('chains', {
  description: 'List the chains a wallet has interacted with.',
  args: addressArg,
  options: paginationOptions,
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { address: '0x1234000000000000000000000000000000000000' },
      description: 'Chains used by a wallet',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = await client.get<unknown[]>('/v1/user/used_chain_list', {
      id: c.args.address,
    });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});

// ---- Protocol positions -----------------------------------------------------

userCli.command('protocols', {
  description: "List a wallet's DeFi protocol positions.",
  args: addressArg,
  options: z.object({
    chain: chainOption.optional().describe('Single chain to scope the query to'),
    chains: z.string().optional().describe('Comma-separated chain ids (all-chain query)'),
    protocol: z.string().optional().describe('Filter to a single protocol id'),
    complex: z
      .boolean()
      .optional()
      .default(false)
      .describe('Use the complex protocol list (full position detail)'),
    ...paginationOptions.shape,
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { address: '0x1234000000000000000000000000000000000000' },
      options: { chain: 'eth', complex: false, page: 1, pageSize: 5 },
      description: 'Simple protocol positions on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);

    if (c.options.protocol) {
      const data = await client.get('/v1/user/protocol', {
        id: c.args.address,
        protocol_id: c.options.protocol,
      });
      return c.ok(data);
    }

    const kind = c.options.complex ? 'complex' : 'simple';
    if (c.options.chain) {
      const results = await client.get<unknown[]>(`/v1/user/${kind}_protocol_list`, {
        id: c.args.address,
        chain_id: resolveChainId(c.options.chain),
      });
      return c.ok(paginate(results, c.options.page, c.options.pageSize));
    }
    const results = await client.get<unknown[]>(`/v1/user/all_${kind}_protocol_list`, {
      id: c.args.address,
      chain_ids: resolveChainIds(c.options.chains),
    });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});

// ---- History ----------------------------------------------------------------

userCli.command('history', {
  description: "Get a wallet's transaction history.",
  args: addressArg,
  options: z.object({
    chain: chainOption.optional().describe('Single chain to scope the query to'),
    chains: z.string().optional().describe('Comma-separated chain ids (all-chain query)'),
    pageCount: z.number().int().min(1).optional().describe('Number of history pages to fetch'),
    startTime: z.number().int().min(0).optional().describe('Unix timestamp to start from'),
    ...paginationOptions.shape,
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { address: '0x1234000000000000000000000000000000000000' },
      options: { chain: 'eth', page: 1, pageSize: 5 },
      description: 'Transaction history on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const params: Record<string, string | number | undefined> = {
      id: c.args.address,
      page_count: c.options.pageCount,
      start_time: c.options.startTime,
    };
    let path: string;
    if (c.options.chain) {
      path = '/v1/user/history_list';
      params.chain_id = resolveChainId(c.options.chain);
    } else {
      path = '/v1/user/history';
      params.chain_ids = resolveChainIds(c.options.chains);
    }
    const results = await client.get<unknown[]>(path, params);
    return c.ok(
      paginate(Array.isArray(results) ? results : [results], c.options.page, c.options.pageSize),
    );
  },
});

// ---- Net-worth curve --------------------------------------------------------

userCli.command('chart', {
  description: "Get a wallet's net-worth curve over time.",
  args: addressArg,
  options: z.object({
    chain: chainOption.optional().describe('Single chain to scope the query to'),
    chains: z.string().optional().describe('Comma-separated chain ids (all-chain query)'),
    ...paginationOptions.shape,
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { address: '0x1234000000000000000000000000000000000000' },
      description: 'Total net-worth curve across all chains',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = c.options.chain
      ? await client.get<unknown[]>('/v1/user/chain_net_curve', {
          id: c.args.address,
          chain_id: resolveChainId(c.options.chain),
        })
      : await client.get<unknown[]>('/v1/user/total_net_curve', {
          id: c.args.address,
          chain_ids: resolveChainIds(c.options.chains),
        });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});

// ---- Authorizations ---------------------------------------------------------

userCli.command('token-auth', {
  description: "List a wallet's token approvals on a chain.",
  args: z.object({
    address: z.string().describe('User wallet address (0x...)'),
    chain: chainOption,
  }),
  options: paginationOptions,
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { address: '0x1234000000000000000000000000000000000000', chain: 'eth' },
      description: 'Token approvals on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = await client.get<unknown[]>('/v1/user/token_auth_list', {
      id: c.args.address,
      chain_id: resolveChainId(c.args.chain),
    });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});

userCli.command('nft-auth', {
  description: "List a wallet's NFT approvals on a chain.",
  args: z.object({
    address: z.string().describe('User wallet address (0x...)'),
    chain: chainOption,
  }),
  options: paginationOptions,
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { address: '0x1234000000000000000000000000000000000000', chain: 'eth' },
      description: 'NFT approvals on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = await client.get<unknown[]>('/v1/user/nft_auth_list', {
      id: c.args.address,
      chain_id: resolveChainId(c.args.chain),
    });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});
