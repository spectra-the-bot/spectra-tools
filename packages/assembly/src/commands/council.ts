import { Cli, z } from 'incur';
import { ASSEMBLY_BASE_URL, createAssemblyClient } from '../api.js';

const assemblyEnv = z.object({
  ASSEMBLY_API_URL: z.string().optional().describe('Assembly API URL'),
  ASSEMBLY_API_KEY: z.string().optional().describe('Assembly API key'),
});

type AssemblyEnv = z.infer<typeof assemblyEnv>;

function getClient(env: AssemblyEnv) {
  const apiUrl = env.ASSEMBLY_API_URL ?? ASSEMBLY_BASE_URL;
  const apiKey = env.ASSEMBLY_API_KEY;
  return createAssemblyClient(apiUrl, apiKey);
}

export const council = Cli.create('council', {
  description: 'Inspect Assembly council members and seats.',
});

council.command('members', {
  description: 'List council members.',
  options: z.object({
    status: z
      .enum(['active', 'inactive', 'all'])
      .optional()
      .default('active')
      .describe('Filter members by status'),
  }),
  env: assemblyEnv,
  examples: [
    { description: 'List active council members' },
    { options: { status: 'all' }, description: 'List all council members' },
  ],
  run(c) {
    const client = getClient(c.env);
    const status = c.options.status === 'all' ? undefined : c.options.status;
    return client.council
      .members(status)
      .then((data) =>
        c.ok(
          data.map((m) => ({
            address: m.address,
            name: m.name,
            status: m.status,
            seatNumber: m.seatNumber,
            joinedAt: new Date(m.joinedAt * 1000).toISOString(),
          })),
          {
            cta: {
              description: 'View member details:',
              commands: [{ command: 'council info', args: { address: '<address>' } }],
            },
          },
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch council members: ${message}`,
          retryable: true,
        });
      });
  },
});

council.command('info', {
  description: 'Get details for a council member.',
  args: z.object({
    address: z.string().describe('Council member wallet address'),
  }),
  env: assemblyEnv,
  examples: [
    {
      args: { address: '0xabc123' },
      description: 'Get info for a specific council member',
    },
  ],
  run(c) {
    const client = getClient(c.env);
    return client.council
      .info(c.args.address)
      .then((data) =>
        c.ok({
          address: data.address,
          name: data.name,
          status: data.status,
          seatNumber: data.seatNumber,
          joinedAt: new Date(data.joinedAt * 1000).toISOString(),
        }),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch council member ${c.args.address}: ${message}`,
          retryable: true,
        });
      });
  },
});

council.command('seats', {
  description: 'List council seats and their status.',
  options: z.object({
    status: z
      .enum(['open', 'filled', 'all'])
      .optional()
      .default('all')
      .describe('Filter seats by status'),
  }),
  env: assemblyEnv,
  examples: [
    { description: 'List all seats' },
    { options: { status: 'open' }, description: 'List open seats' },
  ],
  run(c) {
    const client = getClient(c.env);
    const status = c.options.status === 'all' ? undefined : c.options.status;
    return client.council
      .seats(status)
      .then((data) =>
        c.ok(
          data.map((s) => ({
            seatNumber: s.seatNumber,
            status: s.status,
            holder: s.holder,
          })),
          {
            cta: {
              description: 'View seat holder details:',
              commands: [{ command: 'council info', args: { address: '<address>' } }],
            },
          },
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch council seats: ${message}`,
          retryable: true,
        });
      });
  },
});
