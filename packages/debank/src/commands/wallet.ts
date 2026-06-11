import { readFileSync } from 'node:fs';
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

/**
 * Read a JSON value from either an inline string or a file path.
 * Accepts `@path/to/file.json` to load from disk; otherwise parses the literal.
 */
function readJsonArg(value: string, label: string): unknown {
  const raw = value.startsWith('@') ? readFileSync(value.slice(1), 'utf8') : value;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON for ${label}: ${(err as Error).message}`);
  }
}

export const walletCli = Cli.create('wallet', {
  description: 'Wallet utilities: gas market, transaction explanation, and simulation (read-only).',
});

walletCli.command('gas', {
  description: 'Get the gas price market for a chain.',
  args: z.object({
    chain: chainOption,
  }),
  options: paginationOptions,
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { chain: 'eth' },
      description: 'Gas price tiers on Ethereum',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const results = await client.get<unknown[]>('/v1/wallet/gas_market', {
      chain_id: resolveChainId(c.args.chain),
    });
    return c.ok(paginate(results, c.options.page, c.options.pageSize));
  },
});

walletCli.command('explain', {
  description: 'Explain a transaction (decode intent). Does NOT sign or broadcast.',
  args: z.object({
    tx: z.string().describe('Transaction object as JSON, or @file.json to load from disk'),
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { tx: '@tx.json' },
      description: 'Explain a transaction loaded from tx.json',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const tx = readJsonArg(c.args.tx, 'tx');
    const data = await client.post('/v1/wallet/explain_tx', { tx });
    return c.ok(data);
  },
});

walletCli.command('simulate', {
  description:
    'Simulate (pre-execute) a transaction against current state. Does NOT sign or broadcast.',
  args: z.object({
    tx: z.string().describe('Transaction object as JSON, or @file.json to load from disk'),
  }),
  options: z.object({
    pending: z
      .string()
      .optional()
      .describe(
        'Optional pending tx list as JSON array, or @file.json, applied before the main tx',
      ),
  }),
  env: debankEnv,
  output: z.unknown(),
  examples: [
    {
      args: { tx: '@tx.json' },
      description: 'Dry-run a transaction loaded from tx.json',
    },
  ],
  async run(c) {
    const client = createDebankClient(c.env.ACCESS_KEY);
    const tx = readJsonArg(c.args.tx, 'tx');
    const body: Record<string, unknown> = { tx };
    if (c.options.pending) {
      body.pending_tx_list = readJsonArg(c.options.pending, 'pending');
    }
    const data = await client.post('/v1/wallet/pre_exec_tx', body);
    return c.ok(data);
  },
});
