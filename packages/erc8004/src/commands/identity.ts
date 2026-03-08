import { checksumAddress } from '@spectratools/cli-shared';
import { Cli, z } from 'incur';
import { readContract, writeContract } from 'viem/actions';
import { identityRegistryAbi } from '../contracts/abis.js';
import {
  MULTICALL_BATCH_SIZE,
  abstractMainnet,
  getIdentityRegistryAddress,
  getPublicClient,
  getWalletClient,
} from '../contracts/client.js';

const identity = Cli.create('identity', {
  description: 'Manage ERC-8004 agent identities.',
});

function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

identity.command('list', {
  description: 'List registered agents, optionally filtered by owner.',
  options: z.object({
    owner: z.string().optional().describe('Filter by owner address'),
    limit: z.coerce.number().default(50).describe('Maximum number of results'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    IDENTITY_REGISTRY_ADDRESS: z.string().optional().describe('Identity registry contract address'),
  }),
  output: z.object({
    agents: z.array(
      z.object({
        agentId: z.string(),
        owner: z.string(),
        uri: z.string(),
      }),
    ),
    total: z.number(),
  }),
  examples: [
    { description: 'List first 10 agents', options: { limit: 10 } },
    {
      description: 'List agents owned by an address',
      options: { owner: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', limit: 20 },
    },
  ],
  async run(c) {
    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getIdentityRegistryAddress(c.env);
    const { owner, limit } = c.options;

    const total = await readContract(client, {
      address,
      abi: identityRegistryAbi,
      functionName: 'totalSupply',
    });

    const agents: { agentId: string; owner: string; uri: string }[] = [];
    const totalNum = Number(total);

    if (owner) {
      const ownerAddress = owner as `0x${string}`;
      const balance = await readContract(client, {
        address,
        abi: identityRegistryAbi,
        functionName: 'balanceOf',
        args: [ownerAddress],
      });
      const count = Math.min(Number(balance), limit);

      const ownerIndexBatches = chunk(
        Array.from({ length: count }, (_, i) => BigInt(i)),
        MULTICALL_BATCH_SIZE,
      );

      for (const ownerIndexBatch of ownerIndexBatches) {
        const tokenIdResults = await client.multicall({
          allowFailure: true,
          contracts: ownerIndexBatch.map((index) => ({
            address,
            abi: identityRegistryAbi,
            functionName: 'tokenOfOwnerByIndex',
            args: [ownerAddress, index] as const,
          })),
        });

        const tokenIds: bigint[] = [];
        for (const tokenIdResult of tokenIdResults) {
          if (tokenIdResult.status === 'success') {
            tokenIds.push(tokenIdResult.result as bigint);
          }
        }

        if (tokenIds.length === 0) {
          continue;
        }

        const uriResults = await client.multicall({
          allowFailure: true,
          contracts: tokenIds.map((tokenId) => ({
            address,
            abi: identityRegistryAbi,
            functionName: 'tokenURI',
            args: [tokenId] as const,
          })),
        });

        for (let i = 0; i < tokenIds.length; i++) {
          const uriResult = uriResults[i];
          if (!uriResult || uriResult.status !== 'success') {
            continue;
          }

          agents.push({
            agentId: tokenIds[i].toString(),
            owner: checksumAddress(ownerAddress),
            uri: String(uriResult.result),
          });
        }
      }
    } else {
      const count = Math.min(totalNum, limit);
      const indexBatches = chunk(
        Array.from({ length: count }, (_, i) => BigInt(i)),
        MULTICALL_BATCH_SIZE,
      );

      for (const indexBatch of indexBatches) {
        const tokenIdResults = await client.multicall({
          allowFailure: true,
          contracts: indexBatch.map((index) => ({
            address,
            abi: identityRegistryAbi,
            functionName: 'tokenByIndex',
            args: [index] as const,
          })),
        });

        const tokenIds: bigint[] = [];
        for (const tokenIdResult of tokenIdResults) {
          if (tokenIdResult.status === 'success') {
            tokenIds.push(tokenIdResult.result as bigint);
          }
        }

        if (tokenIds.length === 0) {
          continue;
        }

        const detailsResults = await client.multicall({
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
        });

        for (let i = 0; i < tokenIds.length; i++) {
          const ownerResult = detailsResults[i * 2];
          const uriResult = detailsResults[i * 2 + 1];
          if (
            !ownerResult ||
            !uriResult ||
            ownerResult.status !== 'success' ||
            uriResult.status !== 'success'
          ) {
            continue;
          }

          agents.push({
            agentId: tokenIds[i].toString(),
            owner: checksumAddress(ownerResult.result as `0x${string}`),
            uri: String(uriResult.result),
          });
        }
      }
    }

    return c.ok(
      { agents, total: totalNum },
      {
        cta: {
          description: 'Suggested commands:',
          commands: agents.slice(0, 3).map((a) => ({
            command: 'identity get' as const,
            args: { agentId: a.agentId },
            description: `View agent ${a.agentId}`,
          })),
        },
      },
    );
  },
});

identity.command('get', {
  description: 'Get details for a specific agent.',
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    IDENTITY_REGISTRY_ADDRESS: z.string().optional().describe('Identity registry contract address'),
  }),
  output: z.object({
    agentId: z.string(),
    owner: z.string(),
    uri: z.string(),
    wallet: z.string().optional(),
  }),
  examples: [{ args: { agentId: '1' }, description: 'Get agent #1' }],
  async run(c) {
    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getIdentityRegistryAddress(c.env);
    const tokenId = BigInt(c.args.agentId);

    const [owner, uri, wallet] = await Promise.all([
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
      readContract(client, {
        address,
        abi: identityRegistryAbi,
        functionName: 'getAgentWallet',
        args: [tokenId],
      }).catch(() => undefined),
    ]);

    const result = {
      agentId: c.args.agentId,
      owner: checksumAddress(owner),
      uri,
      ...(wallet && wallet !== '0x0000000000000000000000000000000000000000'
        ? { wallet: checksumAddress(wallet) }
        : {}),
    };

    return c.ok(result, {
      cta: {
        description: 'Suggested commands:',
        commands: [
          {
            command: 'registration fetch' as const,
            args: { agentId: c.args.agentId },
            description: 'Fetch registration file',
          },
          {
            command: 'reputation get' as const,
            args: { agentId: c.args.agentId },
            description: 'View reputation score',
          },
        ],
      },
    });
  },
});

identity.command('register', {
  description: 'Register a new agent identity.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  options: z.object({
    uri: z.string().describe('Registration file URI (IPFS, HTTPS, or data: URI)'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    IDENTITY_REGISTRY_ADDRESS: z.string().optional().describe('Identity registry contract address'),
    PRIVATE_KEY: z.string().optional().describe('Private key for signing (hex with 0x prefix)'),
  }),
  output: z.object({
    agentId: z.string(),
    uri: z.string(),
    txHash: z.string(),
  }),
  examples: [
    {
      options: { uri: 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG' },
      description: 'Register with IPFS URI',
    },
  ],
  async run(c) {
    const privateKey = c.env.PRIVATE_KEY;
    if (!privateKey) {
      return c.error({
        code: 'NO_PRIVATE_KEY',
        message: 'PRIVATE_KEY environment variable is required for write operations.',
        retryable: false,
      });
    }

    const walletClient = getWalletClient(privateKey, c.env.ABSTRACT_RPC_URL);
    const publicClient = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getIdentityRegistryAddress(c.env);

    const hash = await writeContract(walletClient, {
      chain: abstractMainnet,
      address,
      abi: identityRegistryAbi,
      functionName: 'register',
      args: [c.options.uri],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Find token ID from Transfer event log (to == caller, from == zero)
    const transferLog = receipt.logs.find((log) => log.topics[0] !== undefined);
    const agentId = transferLog?.topics[3] ? BigInt(transferLog.topics[3]).toString() : 'unknown';

    return c.ok(
      { agentId, uri: c.options.uri, txHash: hash },
      {
        cta: {
          description: 'Suggested commands:',
          commands: [
            {
              command: 'identity get' as const,
              args: { agentId },
              description: 'View your new agent',
            },
          ],
        },
      },
    );
  },
});

identity.command('update', {
  description: "Update an agent's registration URI.",
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  options: z.object({
    uri: z.string().describe('New registration file URI'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    IDENTITY_REGISTRY_ADDRESS: z.string().optional().describe('Identity registry contract address'),
    PRIVATE_KEY: z.string().optional().describe('Private key for signing'),
  }),
  output: z.object({
    agentId: z.string(),
    uri: z.string(),
    txHash: z.string(),
  }),
  examples: [
    {
      args: { agentId: '1' },
      options: { uri: 'ipfs://bafybeihash/new-agent-registration.json' },
      description: "Update agent #1's registration URI",
    },
  ],
  async run(c) {
    const privateKey = c.env.PRIVATE_KEY;
    if (!privateKey) {
      return c.error({
        code: 'NO_PRIVATE_KEY',
        message: 'PRIVATE_KEY environment variable is required for write operations.',
        retryable: false,
      });
    }

    const walletClient = getWalletClient(privateKey, c.env.ABSTRACT_RPC_URL);
    const address = getIdentityRegistryAddress(c.env);

    const hash = await writeContract(walletClient, {
      chain: abstractMainnet,
      address,
      abi: identityRegistryAbi,
      functionName: 'setAgentURI',
      args: [BigInt(c.args.agentId), c.options.uri],
    });

    return c.ok({ agentId: c.args.agentId, uri: c.options.uri, txHash: hash });
  },
});

identity.command('metadata', {
  description: 'Read agent metadata key(s).',
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  options: z.object({
    key: z.string().optional().describe('Specific metadata key to fetch'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    IDENTITY_REGISTRY_ADDRESS: z.string().optional().describe('Identity registry contract address'),
  }),
  output: z.object({
    agentId: z.string(),
    key: z.string().optional(),
    value: z.string().optional(),
  }),
  examples: [
    {
      args: { agentId: '1' },
      options: { key: 'contact' },
      description: 'Get contact metadata for agent #1',
    },
  ],
  async run(c) {
    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getIdentityRegistryAddress(c.env);
    const tokenId = BigInt(c.args.agentId);
    const { key } = c.options;

    if (!key) {
      return c.ok({ agentId: c.args.agentId });
    }

    const value = await readContract(client, {
      address,
      abi: identityRegistryAbi,
      functionName: 'getMetadata',
      args: [tokenId, key],
    });

    return c.ok({ agentId: c.args.agentId, key, value });
  },
});

identity.command('wallet', {
  description: "Get an agent's associated wallet address.",
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    IDENTITY_REGISTRY_ADDRESS: z.string().optional().describe('Identity registry contract address'),
  }),
  output: z.object({
    agentId: z.string(),
    wallet: z.string(),
  }),
  examples: [{ args: { agentId: '1' }, description: 'Get wallet bound to agent #1' }],
  async run(c) {
    const client = getPublicClient(c.env.ABSTRACT_RPC_URL);
    const address = getIdentityRegistryAddress(c.env);

    const wallet = await readContract(client, {
      address,
      abi: identityRegistryAbi,
      functionName: 'getAgentWallet',
      args: [BigInt(c.args.agentId)],
    });

    return c.ok({ agentId: c.args.agentId, wallet: checksumAddress(wallet) });
  },
});

identity.command('set-wallet', {
  description: "Set an agent's associated wallet address.",
  hint: 'Requires PRIVATE_KEY environment variable. The signature must be from the new wallet.',
  args: z.object({
    agentId: z.string().describe('Agent token ID'),
  }),
  options: z.object({
    wallet: z.string().describe('New wallet address'),
    signature: z.string().describe('Signature from the new wallet authorizing the association'),
  }),
  env: z.object({
    ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL'),
    IDENTITY_REGISTRY_ADDRESS: z.string().optional().describe('Identity registry contract address'),
    PRIVATE_KEY: z.string().optional().describe('Private key for signing'),
  }),
  output: z.object({
    agentId: z.string(),
    wallet: z.string(),
    txHash: z.string(),
  }),
  examples: [
    {
      args: { agentId: '1' },
      options: {
        wallet: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        signature: '0x1234...abcd',
      },
      description: 'Associate a new wallet with agent #1',
    },
  ],
  async run(c) {
    const privateKey = c.env.PRIVATE_KEY;
    if (!privateKey) {
      return c.error({
        code: 'NO_PRIVATE_KEY',
        message: 'PRIVATE_KEY environment variable is required for write operations.',
        retryable: false,
      });
    }

    const walletClient = getWalletClient(privateKey, c.env.ABSTRACT_RPC_URL);
    const address = getIdentityRegistryAddress(c.env);

    const hash = await writeContract(walletClient, {
      chain: abstractMainnet,
      address,
      abi: identityRegistryAbi,
      functionName: 'setAgentWallet',
      args: [
        BigInt(c.args.agentId),
        c.options.wallet as `0x${string}`,
        c.options.signature as `0x${string}`,
      ],
    });

    return c.ok({
      agentId: c.args.agentId,
      wallet: checksumAddress(c.options.wallet),
      txHash: hash,
    });
  },
});

export { identity };
