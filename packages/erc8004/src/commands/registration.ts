import { createHttpClient } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { type Registration, registrationSchema } from '../schema.js';

const registration = Cli.create('registration', {
  description: 'Fetch, validate, and create ERC-8004 registration files.',
});

/** Fetches registration JSON from a URI (HTTPS, IPFS, or data:). */
async function fetchRegistrationFromUri(uri: string): Promise<unknown> {
  if (uri.startsWith('data:')) {
    const commaIdx = uri.indexOf(',');
    if (commaIdx === -1) throw new Error('Invalid data URI');
    const payload = uri.slice(commaIdx + 1);
    const isBase64 = uri.slice(0, commaIdx).includes('base64');
    const text = isBase64 ? atob(payload) : decodeURIComponent(payload);
    return JSON.parse(text);
  }

  let httpUrl = uri;
  if (uri.startsWith('ipfs://')) {
    httpUrl = `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }

  const client = createHttpClient({ baseUrl: httpUrl.replace(/\/[^/]*$/, '') });
  const path = `/${httpUrl.split('/').slice(3).join('/')}`;
  return client.request<unknown>(path || '/');
}

registration.command('fetch', {
  description: 'Fetch and parse the registration file for an agent.',
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    IDENTITY_REGISTRY_ADDRESS: z.string().optional().describe('Identity registry contract address'),
  }),
  output: z.object({
    agentId: z.string(),
    uri: z.string(),
    registration: registrationSchema,
    valid: z.boolean(),
  }),
  examples: [{ args: { agentId: '1' }, description: 'Fetch registration for agent #1' }],
  async run(c) {
    // Dynamically import viem/actions to avoid circular deps
    const { readContract } = await import('viem/actions');
    const { getPublicClient, getIdentityRegistryAddress } = await import('../contracts/client.js');
    const { identityRegistryAbi } = await import('../contracts/abis.js');

    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getIdentityRegistryAddress(c.env);

    const uri = await readContract(client, {
      address,
      abi: identityRegistryAbi,
      functionName: 'tokenURI',
      args: [BigInt(c.args.agentId)],
    });

    const raw = await fetchRegistrationFromUri(uri);
    const parsed = registrationSchema.safeParse(raw);

    if (!parsed.success) {
      return c.ok(
        {
          agentId: c.args.agentId,
          uri,
          registration: raw as Registration,
          valid: false,
        },
        {
          cta: {
            description: 'The registration file has validation errors. Review with:',
            commands: [
              {
                command: 'registration validate' as const,
                args: { uri },
                description: 'Validate the registration file',
              },
            ],
          },
        },
      );
    }

    return c.ok(
      { agentId: c.args.agentId, uri, registration: parsed.data, valid: true },
      {
        cta: {
          description: 'Suggested commands:',
          commands: [
            {
              command: 'reputation feedback' as const,
              args: { agentId: c.args.agentId },
              description: 'Submit feedback for this agent',
            },
          ],
        },
      },
    );
  },
});

registration.command('validate', {
  description: 'Validate a registration file at a given URI.',
  args: z.object({
    uri: z.string().describe('URI to the registration file (HTTPS, IPFS, or data:)'),
  }),
  output: z.object({
    uri: z.string(),
    valid: z.boolean(),
    errors: z.array(z.string()).optional(),
    registration: registrationSchema.optional(),
  }),
  examples: [
    {
      args: { uri: 'https://example.com/agent.json' },
      description: 'Validate an HTTPS registration file',
    },
    {
      args: { uri: 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG' },
      description: 'Validate an IPFS registration file',
    },
  ],
  async run(c) {
    const raw = await fetchRegistrationFromUri(c.args.uri);
    const parsed = registrationSchema.safeParse(raw);

    if (!parsed.success) {
      const errors = parsed.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      );
      return c.ok({ uri: c.args.uri, valid: false, errors });
    }

    return c.ok({ uri: c.args.uri, valid: true, registration: parsed.data });
  },
});

registration.command('create', {
  description: 'Generate a registration JSON file for an agent.',
  options: z.object({
    name: z.string().describe('Agent name'),
    description: z.string().optional().describe('Agent description'),
    agentVersion: z.string().optional().describe('Agent version (semver)'),
    homepage: z.string().optional().describe('Agent homepage URL'),
    capabilities: z.array(z.string()).optional().describe('Capability tags'),
  }),
  output: registrationSchema,
  examples: [
    {
      options: {
        name: 'My Agent',
        description: 'A helpful AI agent',
        agentVersion: '1.0.0',
        capabilities: ['code-review', 'data-analysis'],
      },
      description: 'Create a basic registration file',
    },
  ],
  run(c) {
    const reg: Registration = {
      name: c.options.name,
      erc8004: { version: '0.1.0' },
    };

    if (c.options.description !== undefined) reg.description = c.options.description;
    if (c.options.agentVersion !== undefined) reg.version = c.options.agentVersion;
    if (c.options.homepage !== undefined) reg.homepage = c.options.homepage;
    if (c.options.capabilities !== undefined) reg.capabilities = c.options.capabilities;

    return c.ok(reg);
  },
});

export { registration };
