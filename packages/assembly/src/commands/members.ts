import { Cli, z } from 'incur';
import { ASSEMBLY_BASE_URL, createAssemblyClient } from '../api.js';

function getClient() {
  const baseUrl = process.env.ABSTRACT_RPC_URL ?? ASSEMBLY_BASE_URL;
  const apiKey = process.env.ASSEMBLY_API_KEY;
  return createAssemblyClient(baseUrl, apiKey);
}

export const members = Cli.create('members', {
  description: 'Inspect Assembly members and membership status.',
});

members.command('list', {
  description: 'List Assembly members.',
  options: z.object({
    role: z
      .enum(['council', 'voter', 'all'])
      .optional()
      .default('all')
      .describe('Filter members by role'),
  }),
  examples: [
    { description: 'List all members' },
    { options: { role: 'council' }, description: 'List council members only' },
    { options: { role: 'voter' }, description: 'List voters only' },
  ],
  run(c) {
    const client = getClient();
    return client.members
      .list(c.options.role)
      .then((data) =>
        c.ok(
          data.map((m) => ({
            address: m.address,
            role: m.role,
            joinedAt: new Date(m.joinedAt * 1000).toISOString(),
            votingPower: m.votingPower,
          })),
          {
            cta: {
              description: 'View member details:',
              commands: [{ command: 'members info', args: { address: '<address>' } }],
            },
          },
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch members: ${message}`,
          retryable: true,
        });
      });
  },
});

members.command('info', {
  description: 'Get details for an Assembly member.',
  args: z.object({
    address: z.string().describe('Member wallet address'),
  }),
  examples: [
    {
      args: { address: '0xabc123' },
      description: 'Get info for a specific member',
    },
  ],
  run(c) {
    const client = getClient();
    return client.members
      .info(c.args.address)
      .then((data) =>
        c.ok({
          address: data.address,
          role: data.role,
          joinedAt: new Date(data.joinedAt * 1000).toISOString(),
          votingPower: data.votingPower,
        }),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch member ${c.args.address}: ${message}`,
          retryable: true,
        });
      });
  },
});

members.command('status', {
  description: 'Check membership status for an address.',
  options: z.object({
    address: z.string().optional().describe('Address to check (defaults to own wallet)'),
  }),
  examples: [
    { description: 'Check own membership status' },
    { options: { address: '0xabc123' }, description: 'Check membership for a specific address' },
  ],
  run(c) {
    const client = getClient();
    const address = c.options.address ?? process.env.ABSTRACT_WALLET_ADDRESS ?? '';
    if (!address) {
      return c.error({
        code: 'MISSING_ADDRESS',
        message: 'No address provided. Pass --address or set ABSTRACT_WALLET_ADDRESS.',
        retryable: false,
      });
    }
    return client.members
      .status(address)
      .then((data) =>
        c.ok({
          address: data.address,
          role: data.role,
          joinedAt: new Date(data.joinedAt * 1000).toISOString(),
          votingPower: data.votingPower,
          isMember: true,
        }),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to check membership status: ${message}`,
          retryable: true,
        });
      });
  },
});
