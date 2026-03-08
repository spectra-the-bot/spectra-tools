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

const ENUMERATION_UNSUPPORTED_MESSAGE =
  'This registry does not support enumeration. Use `identity get <agentId>` for direct lookups.';
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
    text.includes('tokenofownerbyindex') ||
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

    const agents: { agentId: string; owner: string; uri: string }[] = [];
    let total = 0;

    if (owner) {
      const ownerAddress = owner as `0x${string}`;

      let balance: bigint;
      try {
        balance = await readContract(client, {
          address,
          abi: identityRegistryAbi,
          functionName: 'balanceOf',
          args: [ownerAddress],
        });
      } catch (error) {
        return viemError(c, error, {
          code: 'IDENTITY_LIST_FAILED',
          message: 'Could not read owner balance from this registry.',
          retryable: true,
        });
      }

      total = Number(balance);
      const count = Math.min(total, limit);

      if (count > 0) {
        type TransferToOwnerEvent = { args: { tokenId?: bigint } };

        let transferToOwnerEvents: TransferToOwnerEvent[];
        try {
          transferToOwnerEvents = (await client.getContractEvents({
            abi: identityRegistryAbi,
            address,
            eventName: 'Transfer',
            args: { to: ownerAddress },
            fromBlock: 0n,
            strict: true,
          })) as TransferToOwnerEvent[];
        } catch (error) {
          return viemError(c, error, {
            code: 'IDENTITY_LIST_FAILED',
            message: 'Could not scan owner transfer history for this registry.',
            retryable: true,
          });
        }

        const seen = new Set<string>();
        const candidateTokenIds: bigint[] = [];

        for (let i = transferToOwnerEvents.length - 1; i >= 0; i -= 1) {
          const tokenId = transferToOwnerEvents[i]?.args?.tokenId;
          if (typeof tokenId !== 'bigint') {
            continue;
          }

          const tokenKey = tokenId.toString();
          if (seen.has(tokenKey)) {
            continue;
          }

          seen.add(tokenKey);
          candidateTokenIds.push(tokenId);
        }

        const ownerLower = ownerAddress.toLowerCase();

        for (const tokenId of candidateTokenIds) {
          if (agents.length >= count) {
            break;
          }

          let currentOwner: `0x${string}`;
          try {
            currentOwner = await readContract(client, {
              address,
              abi: identityRegistryAbi,
              functionName: 'ownerOf',
              args: [tokenId],
            });
          } catch (error) {
            if (isViemLikeError(error)) {
              continue;
            }
            throw error;
          }

          if (currentOwner.toLowerCase() !== ownerLower) {
            continue;
          }

          let uri: string;
          try {
            uri = await readContract(client, {
              address,
              abi: identityRegistryAbi,
              functionName: 'tokenURI',
              args: [tokenId],
            });
          } catch (error) {
            if (isViemLikeError(error)) {
              continue;
            }
            throw error;
          }

          agents.push({
            agentId: tokenId.toString(),
            owner: checksumAddress(ownerAddress),
            uri,
          });
        }
      }
    } else {
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
            message: ENUMERATION_UNSUPPORTED_MESSAGE,
            retryable: false,
          });
        }

        return viemError(c, error, {
          code: 'IDENTITY_LIST_FAILED',
          message: 'Could not read registry supply from this contract.',
          retryable: true,
        });
      }

      total = Number(totalSupply);
      const count = Math.min(total, limit);
      const indexBatches = chunk(
        Array.from({ length: count }, (_, i) => BigInt(i)),
        MULTICALL_BATCH_SIZE,
      );

      for (const indexBatch of indexBatches) {
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
              message: ENUMERATION_UNSUPPORTED_MESSAGE,
              retryable: false,
            });
          }

          return viemError(c, error, {
            code: 'IDENTITY_LIST_FAILED',
            message: 'Could not enumerate agent IDs from this registry.',
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
            message: ENUMERATION_UNSUPPORTED_MESSAGE,
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
            code: 'IDENTITY_LIST_FAILED',
            message: 'Could not read agent details from this registry.',
            retryable: true,
          });
        }

        for (let i = 0; i < tokenIds.length; i += 1) {
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
      { agents, total },
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
