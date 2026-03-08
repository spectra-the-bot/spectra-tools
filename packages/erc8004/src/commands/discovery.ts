import { checksumAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { readContract } from 'viem/actions';
import { identityRegistryAbi } from '../contracts/abis.js';
import { getIdentityRegistryAddress, getPublicClient } from '../contracts/client.js';
import { registrationSchema } from '../schema.js';
import { fetchRegistrationUri } from '../utils/fetch-uri.js';

const discovery = Cli.create('discovery', {
  description: 'Discover and resolve ERC-8004 agents.',
});

/** Fetch and parse a registration file from a URI, returning null on failure. */
async function tryFetchRegistration(uri: string) {
  try {
    const raw = await fetchRegistrationUri(uri);
    const parsed = registrationSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

discovery.command('search', {
  description: 'Search for registered agents by name or service type.',
  options: z.object({
    name: z.string().optional().describe('Search agents by name (case-insensitive substring)'),
    service: z.string().optional().describe('Filter by service type (e.g. "mcp", "openapi")'),
    limit: z.coerce.number().default(20).describe('Maximum number of results'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    IDENTITY_REGISTRY_ADDRESS: z.string().optional().describe('Identity registry contract address'),
  }),
  output: z.object({
    results: z.array(
      z.object({
        agentId: z.string(),
        owner: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        services: z.array(z.string()).optional(),
        uri: z.string(),
      }),
    ),
    total: z.number(),
  }),
  examples: [
    { options: { name: 'assistant' }, description: 'Search for agents named "assistant"' },
    { options: { service: 'mcp' }, description: 'Find agents with MCP service endpoints' },
    { options: { name: 'coder', service: 'openapi', limit: 5 }, description: 'Combined search' },
  ],
  async run(c) {
    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getIdentityRegistryAddress(c.env);
    const { name, service, limit } = c.options;

    const total = await readContract(client, {
      address,
      abi: identityRegistryAbi,
      functionName: 'totalSupply',
    });

    const results: {
      agentId: string;
      owner: string;
      name?: string;
      description?: string;
      services?: string[];
      uri: string;
    }[] = [];

    const totalNum = Number(total);

    for (let i = 0; i < totalNum && results.length < limit; i++) {
      const tokenId = await readContract(client, {
        address,
        abi: identityRegistryAbi,
        functionName: 'tokenByIndex',
        args: [BigInt(i)],
      });

      const [owner, uri] = await Promise.all([
        readContract(client, {
          address,
          abi: identityRegistryAbi,
          functionName: 'ownerOf',
          args: [tokenId],
        }),
        readContract(client, {
          address,
          abi: identityRegistryAbi,
          functionName: 'tokenURI',
          args: [tokenId],
        }),
      ]);

      const reg = await tryFetchRegistration(uri);

      // Apply filters
      if (name && reg && !reg.name.toLowerCase().includes(name.toLowerCase())) {
        continue;
      }
      if (service && reg?.services) {
        const needle = service.toLowerCase();
        const hasService = reg.services.some((s) => {
          const typeOrName = s.type ?? s.name;
          return typeOrName !== undefined && typeOrName.toLowerCase() === needle;
        });
        if (!hasService) continue;
      }
      if (service && !reg?.services) continue;

      results.push({
        agentId: tokenId.toString(),
        owner: checksumAddress(owner),
        ...(reg?.name !== undefined ? { name: reg.name } : {}),
        ...(reg?.description !== undefined ? { description: reg.description } : {}),
        ...(reg?.services !== undefined
          ? {
              services: reg.services
                .map((s) => s.type ?? s.name)
                .filter((value): value is string => value !== undefined),
            }
          : {}),
        uri,
      });
    }

    return c.ok(
      { results, total: results.length },
      {
        cta: {
          description: 'Suggested commands:',
          commands: results.slice(0, 2).map((r) => ({
            command: 'identity get' as const,
            args: { agentId: r.agentId },
            description: `View ${r.name ?? `agent ${r.agentId}`}`,
          })),
        },
      },
    );
  },
});

discovery.command('resolve', {
  description: 'Resolve a full agent identifier (<registry>:<agentId>) to agent details.',
  args: z.object({
    identifier: z.string().describe('Agent identifier in format <registryAddress>:<agentId>'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
  }),
  output: z.object({
    identifier: z.string(),
    registry: z.string(),
    agentId: z.string(),
    owner: z.string(),
    uri: z.string(),
    name: z.string().optional(),
    description: z.string().optional(),
  }),
  examples: [
    {
      args: { identifier: '0xRegistryAddress:42' },
      description: 'Resolve agent #42 from a specific registry',
    },
  ],
  async run(c) {
    const parts = c.args.identifier.split(':');
    if (parts.length < 2) {
      return c.error({
        code: 'INVALID_IDENTIFIER',
        message: 'Identifier must be in format <registryAddress>:<agentId> (e.g. 0xABC...123:42)',
        retryable: false,
      });
    }

    const registryAddress = parts[0] as `0x${string}`;
    const agentId = parts.slice(1).join(':');

    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const tokenId = BigInt(agentId);

    const [owner, uri] = await Promise.all([
      readContract(client, {
        address: registryAddress,
        abi: identityRegistryAbi,
        functionName: 'ownerOf',
        args: [tokenId],
      }),
      readContract(client, {
        address: registryAddress,
        abi: identityRegistryAbi,
        functionName: 'tokenURI',
        args: [tokenId],
      }),
    ]);

    const reg = await tryFetchRegistration(uri);

    return c.ok({
      identifier: c.args.identifier,
      registry: checksumAddress(registryAddress),
      agentId,
      owner: checksumAddress(owner),
      uri,
      ...(reg?.name !== undefined ? { name: reg.name } : {}),
      ...(reg?.description !== undefined ? { description: reg.description } : {}),
    });
  },
});

export { discovery };
