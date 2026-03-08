import { checksumAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { readContract } from 'viem/actions';
import { identityRegistryAbi } from '../contracts/abis.js';
import {
  MULTICALL_BATCH_SIZE,
  getIdentityRegistryAddress,
  getPublicClient,
} from '../contracts/client.js';
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

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

const DISCOVERY_ENUMERATION_MESSAGE =
  'Discovery search requires registry enumeration, but this registry does not support it. Use `identity get <agentId>` for direct lookups.';
const VIEM_ERROR_NAMES = new Set([
  'AbiFunctionNotFoundError',
  'CallExecutionError',
  'ContractFunctionExecutionError',
  'ContractFunctionRevertedError',
  'HttpRequestError',
  'InvalidAddressError',
  'TransactionExecutionError',
]);

type CliErrorContext = {
  error: (options: { code: string; message: string; retryable?: boolean }) => never;
};

function isViemLikeError(error: unknown): error is Error & { shortMessage?: string } {
  if (!(error instanceof Error)) {
    return false;
  }

  const shortMessage = (error as { shortMessage?: unknown }).shortMessage;
  return (
    VIEM_ERROR_NAMES.has(error.name) ||
    (typeof shortMessage === 'string' && shortMessage.length > 0) ||
    error.message.includes('Docs: https://viem.sh') ||
    error.message.includes('Version: viem@')
  );
}

function isEnumerableFailure(error: unknown): boolean {
  if (!isViemLikeError(error)) {
    return false;
  }

  const shortMessage =
    typeof error.shortMessage === 'string' && error.shortMessage.trim().length > 0
      ? error.shortMessage
      : '';
  const text = `${error.name} ${shortMessage} ${error.message}`.toLowerCase();

  return (
    text.includes('totalsupply') ||
    text.includes('tokenbyindex') ||
    text.includes('enumerable') ||
    text.includes('function does not exist')
  );
}

function viemError(
  c: CliErrorContext,
  error: unknown,
  fallback: { code: string; message: string; retryable?: boolean },
): never {
  if (isViemLikeError(error)) {
    return c.error(fallback);
  }

  throw error;
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
    IPFS_GATEWAY: z
      .string()
      .optional()
      .describe('IPFS gateway override (default: https://ipfs.io)'),
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

    let totalSupply: bigint;
    try {
      totalSupply = await readContract(client, {
        address,
        abi: identityRegistryAbi,
        functionName: 'totalSupply',
      });
    } catch (error) {
      if (isEnumerableFailure(error)) {
        return c.error({
          code: 'ENUMERATION_UNSUPPORTED',
          message: DISCOVERY_ENUMERATION_MESSAGE,
          retryable: false,
        });
      }

      return viemError(c, error, {
        code: 'DISCOVERY_SEARCH_FAILED',
        message: 'Could not read registry supply for discovery search.',
        retryable: true,
      });
    }

    const results: {
      agentId: string;
      owner: string;
      name?: string;
      description?: string;
      services?: string[];
      uri: string;
    }[] = [];

    const totalNum = Number(totalSupply);
    const indexedBatches = chunk(
      Array.from({ length: totalNum }, (_, i) => BigInt(i)),
      MULTICALL_BATCH_SIZE,
    );

    for (const indexBatch of indexedBatches) {
      if (results.length >= limit) {
        break;
      }

      let tokenIdResults: Array<
        { status: 'success'; result: unknown } | { status: 'failure'; error: unknown }
      >;
      try {
        tokenIdResults = (await client.multicall({
          allowFailure: true,
          contracts: indexBatch.map((index) => ({
            address,
            abi: identityRegistryAbi,
            functionName: 'tokenByIndex',
            args: [index] as const,
          })),
        })) as Array<
          { status: 'success'; result: unknown } | { status: 'failure'; error: unknown }
        >;
      } catch (error) {
        if (isEnumerableFailure(error)) {
          return c.error({
            code: 'ENUMERATION_UNSUPPORTED',
            message: DISCOVERY_ENUMERATION_MESSAGE,
            retryable: false,
          });
        }

        return viemError(c, error, {
          code: 'DISCOVERY_SEARCH_FAILED',
          message: 'Could not enumerate agents for discovery search.',
          retryable: true,
        });
      }

      const tokenIds: bigint[] = [];
      let failedCalls = 0;
      for (const tokenIdResult of tokenIdResults) {
        if (tokenIdResult.status === 'success') {
          tokenIds.push(tokenIdResult.result as bigint);
          continue;
        }

        failedCalls += 1;
      }

      if (tokenIdResults.length > 0 && failedCalls === tokenIdResults.length) {
        return c.error({
          code: 'ENUMERATION_UNSUPPORTED',
          message: DISCOVERY_ENUMERATION_MESSAGE,
          retryable: false,
        });
      }

      if (tokenIds.length === 0) {
        continue;
      }

      let detailsResults: Array<
        { status: 'success'; result: unknown } | { status: 'failure'; error: unknown }
      >;
      try {
        detailsResults = (await client.multicall({
          allowFailure: true,
          contracts: tokenIds.flatMap((tokenId) => [
            {
              address,
              abi: identityRegistryAbi,
              functionName: 'ownerOf' as const,
              args: [tokenId] as const,
            },
            {
              address,
              abi: identityRegistryAbi,
              functionName: 'tokenURI' as const,
              args: [tokenId] as const,
            },
          ]),
        })) as Array<
          { status: 'success'; result: unknown } | { status: 'failure'; error: unknown }
        >;
      } catch (error) {
        return viemError(c, error, {
          code: 'DISCOVERY_SEARCH_FAILED',
          message: 'Could not read agent details for discovery search.',
          retryable: true,
        });
      }

      const details: { tokenId: bigint; owner: `0x${string}`; uri: string }[] = [];
      for (let i = 0; i < tokenIds.length; i += 1) {
        const ownerResult = detailsResults[i * 2];
        const uriResult = detailsResults[i * 2 + 1];

        if (!ownerResult || !uriResult) {
          continue;
        }

        if (ownerResult.status !== 'success' || uriResult.status !== 'success') {
          continue;
        }

        details.push({
          tokenId: tokenIds[i],
          owner: ownerResult.result as `0x${string}`,
          uri: uriResult.result as string,
        });
      }

      const registrations = await Promise.all(
        details.map((detail) => tryFetchRegistration(detail.uri)),
      );

      for (let i = 0; i < details.length; i += 1) {
        if (results.length >= limit) {
          break;
        }

        const detail = details[i];
        const reg = registrations[i];

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
          agentId: detail.tokenId.toString(),
          owner: checksumAddress(detail.owner),
          ...(reg?.name !== undefined ? { name: reg.name } : {}),
          ...(reg?.description !== undefined ? { description: reg.description } : {}),
          ...(reg?.services !== undefined
            ? {
                services: reg.services
                  .map((s) => s.type ?? s.name)
                  .filter((value): value is string => value !== undefined),
              }
            : {}),
          uri: detail.uri,
        });
      }
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
    IPFS_GATEWAY: z
      .string()
      .optional()
      .describe('IPFS gateway override (default: https://ipfs.io)'),
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
