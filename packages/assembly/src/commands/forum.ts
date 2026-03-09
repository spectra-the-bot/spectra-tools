import { TxError } from '@spectratools/tx-shared';
import { Cli, z } from 'incur';
import { forumAbi, registryAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, jsonSafe, relTime, timeValue, toChecksum } from './_common.js';
import {
  type FormattedDryRunResult,
  type FormattedTxResult,
  assemblyWriteTx,
  resolveAccount,
  writeEnv,
  writeOptions,
} from './_write-utils.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

const commentEnv = env.extend({
  PRIVATE_KEY: z
    .string()
    .optional()
    .describe('Private key (required only when posting a comment via --body)'),
});

type ThreadTuple = readonly [
  bigint,
  bigint,
  string,
  bigint,
  string,
  string,
  string,
  bigint,
  bigint,
];
type CommentTuple = readonly [bigint, bigint, bigint, string, bigint, string];
type PetitionTuple = readonly [
  bigint,
  string,
  bigint,
  string,
  string,
  string,
  bigint,
  boolean,
  bigint,
  unknown,
];

const timestampOutput = z.union([z.number(), z.string()]);

const txResultOutput = z.union([
  z.object({
    status: z.literal('success'),
    hash: z.string(),
    blockNumber: z.number(),
    gasUsed: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    effectiveGasPrice: z.string().optional(),
  }),
  z.object({
    status: z.literal('reverted'),
    hash: z.string(),
    blockNumber: z.number(),
    gasUsed: z.string(),
    from: z.string(),
    to: z.string().nullable(),
    effectiveGasPrice: z.string().optional(),
  }),
  z.object({
    status: z.literal('dry-run'),
    estimatedGas: z.string(),
    simulationResult: z.unknown(),
  }),
]);

function decodeThread(value: unknown) {
  const [id, kind, author, createdAt, category, title, body, proposalId, petitionId] =
    value as ThreadTuple;

  return {
    id: asNum(id),
    kind: asNum(kind),
    author: toChecksum(author),
    createdAt: asNum(createdAt),
    category,
    title,
    body,
    proposalId: asNum(proposalId),
    petitionId: asNum(petitionId),
  };
}

function decodeComment(value: unknown) {
  const [id, threadId, parentId, author, createdAt, body] = value as CommentTuple;

  return {
    id: asNum(id),
    threadId: asNum(threadId),
    parentId: asNum(parentId),
    author: toChecksum(author),
    createdAt: asNum(createdAt),
    body,
  };
}

function decodePetition(value: unknown) {
  const [
    id,
    proposer,
    createdAt,
    category,
    title,
    body,
    signatures,
    promoted,
    threadId,
    proposalInput,
  ] = value as PetitionTuple;

  return {
    id: asNum(id),
    proposer: toChecksum(proposer),
    createdAt: asNum(createdAt),
    category,
    title,
    body,
    signatures: asNum(signatures),
    promoted,
    threadId: asNum(threadId),
    proposalInput: jsonSafe(proposalInput),
  };
}

export const forum = Cli.create('forum', {
  description: 'Browse Assembly forum threads, comments, and petitions.',
});

forum.command('threads', {
  description: 'List forum threads with author and creation metadata.',
  env,
  output: z.object({
    threads: z.array(
      z.object({
        id: z.number(),
        kind: z.number(),
        author: z.string(),
        createdAt: timestampOutput,
        createdAtRelative: z.string(),
        category: z.string().nullable().optional(),
        title: z.string().nullable().optional(),
      }),
    ),
    count: z.number(),
  }),
  examples: [{ description: 'List all forum threads' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'threadCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const threadTuples = ids.length
      ? await client.multicall({
          allowFailure: false,
          contracts: ids.map((id) => ({
            abi: forumAbi,
            address: ABSTRACT_MAINNET_ADDRESSES.forum,
            functionName: 'threads',
            args: [id] as const,
          })),
        })
      : [];
    const items = (threadTuples as unknown[]).map(decodeThread);
    const threads = items.map((x) => ({
      id: x.id,
      kind: x.kind,
      author: x.author,
      createdAt: timeValue(x.createdAt, c.format),
      createdAtRelative: relTime(x.createdAt),
      category: x.category ?? null,
      title: x.title ?? null,
    }));

    return c.ok(
      {
        threads,
        count: threads.length,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Inspect or comment:',
              commands: [
                { command: 'forum thread', args: { id: '<id>' } },
                { command: 'forum post-comment', args: { threadId: '<id>' } },
              ],
            },
          },
    );
  },
});

forum.command('thread', {
  description: 'Get one thread and all comments associated with it.',
  args: z.object({
    id: z.coerce.number().int().positive().describe('Thread id (1-indexed)'),
  }),
  env,
  output: z.object({
    thread: z.record(z.string(), z.unknown()),
    comments: z.array(z.record(z.string(), z.unknown())),
  }),
  examples: [{ args: { id: 1 }, description: 'Fetch thread #1 and its comments' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const threadCount = (await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'threadCount',
    })) as bigint;

    if (c.args.id > Number(threadCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Thread id ${c.args.id} does not exist (threadCount: ${threadCount})`,
        retryable: false,
      });
    }

    const [threadTuple, commentCount] = (await Promise.all([
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'threads',
        args: [BigInt(c.args.id)],
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'commentCount',
      }),
    ])) as [unknown, bigint];
    const thread = decodeThread(threadTuple);

    const ids = Array.from({ length: Number(commentCount) }, (_, i) => BigInt(i + 1));
    const commentTuples = ids.length
      ? await client.multicall({
          allowFailure: false,
          contracts: ids.map((id) => ({
            abi: forumAbi,
            address: ABSTRACT_MAINNET_ADDRESSES.forum,
            functionName: 'comments',
            args: [id] as const,
          })),
        })
      : [];
    const comments = (commentTuples as unknown[]).map(decodeComment);

    return c.ok({
      thread: jsonSafe(thread) as Record<string, unknown>,
      comments: comments
        .filter((x) => x.threadId === c.args.id)
        .map((comment) => jsonSafe(comment) as Record<string, unknown>),
    });
  },
});

forum.command('comments', {
  description: 'List comments for a thread id.',
  args: z.object({
    threadId: z.coerce.number().int().positive().describe('Thread id to filter comments by'),
  }),
  env,
  output: z.array(z.record(z.string(), z.unknown())),
  examples: [{ args: { threadId: 1 }, description: 'List comments for thread #1' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = (await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'commentCount',
    })) as bigint;
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const commentTuples = ids.length
      ? await client.multicall({
          allowFailure: false,
          contracts: ids.map((id) => ({
            abi: forumAbi,
            address: ABSTRACT_MAINNET_ADDRESSES.forum,
            functionName: 'comments',
            args: [id] as const,
          })),
        })
      : [];
    const comments = (commentTuples as unknown[]).map(decodeComment);

    return c.ok(
      comments
        .filter((x) => x.threadId === c.args.threadId)
        .map((comment) => jsonSafe(comment) as Record<string, unknown>),
    );
  },
});

forum.command('comment', {
  description: 'Get one comment by id, or post to a thread when --body is provided.',
  args: z.object({
    id: z.coerce.number().int().positive().describe('Comment id (read) or thread id (write)'),
  }),
  options: writeOptions.extend({
    body: z.string().min(1).optional().describe('Comment body (write mode)'),
    'parent-id': z.coerce
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe('Optional parent comment id for threaded replies (write mode)'),
  }),
  env: commentEnv,
  output: z.record(z.string(), z.unknown()),
  examples: [
    { args: { id: 1 }, description: 'Fetch comment #1' },
    {
      args: { id: 1 },
      options: { body: 'I support this proposal.' },
      description: 'Post a new comment on thread #1',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);

    if (!c.options.body) {
      const commentCount = (await client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'commentCount',
      })) as bigint;

      if (c.args.id > Number(commentCount)) {
        return c.error({
          code: 'OUT_OF_RANGE',
          message: `Comment id ${c.args.id} does not exist (commentCount: ${commentCount})`,
          retryable: false,
        });
      }

      const commentTuple = await client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'comments',
        args: [BigInt(c.args.id)],
      });
      return c.ok(jsonSafe(decodeComment(commentTuple)) as Record<string, unknown>);
    }

    if (!c.env.PRIVATE_KEY) {
      return c.error({
        code: 'MISSING_PRIVATE_KEY',
        message: 'PRIVATE_KEY is required when posting a comment.',
        retryable: false,
      });
    }

    const account = resolveAccount({ PRIVATE_KEY: c.env.PRIVATE_KEY });
    const [activeMember, threadCount, commentCount] = (await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'isActive',
        args: [account.address],
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'threadCount',
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'commentCount',
      }),
    ])) as [boolean, bigint, bigint];

    if (!activeMember) {
      return c.error({
        code: 'NOT_ACTIVE_MEMBER',
        message: `Address ${toChecksum(account.address)} is not an active Assembly member.`,
        retryable: false,
      });
    }

    if (c.args.id > Number(threadCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Thread id ${c.args.id} does not exist (threadCount: ${threadCount})`,
        retryable: false,
      });
    }

    if (c.options['parent-id'] > Number(commentCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Parent comment id ${c.options['parent-id']} does not exist (commentCount: ${commentCount})`,
        retryable: false,
      });
    }

    const expectedCommentId = Number(commentCount) + 1;

    try {
      const txResult = await assemblyWriteTx({
        env: {
          PRIVATE_KEY: c.env.PRIVATE_KEY,
          ABSTRACT_RPC_URL: c.env.ABSTRACT_RPC_URL,
        },
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        abi: forumAbi,
        functionName: 'postComment',
        args: [BigInt(c.args.id), BigInt(c.options['parent-id']), c.options.body],
      });

      return c.ok({
        author: toChecksum(account.address),
        threadId: c.args.id,
        parentId: c.options['parent-id'],
        expectedCommentId,
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      });
    } catch (error) {
      if (error instanceof TxError) {
        return c.error({
          code: error.code,
          message: error.message,
          retryable: error.code === 'NONCE_CONFLICT',
        });
      }
      throw error;
    }
  },
});

forum.command('post', {
  description: 'Create a new discussion thread in the forum.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  options: writeOptions.extend({
    category: z.string().min(1).describe('Thread category label (e.g., general, governance)'),
    title: z.string().min(1).describe('Thread title'),
    body: z.string().min(1).describe('Thread body'),
  }),
  env: writeEnv,
  output: z.object({
    author: z.string(),
    category: z.string(),
    title: z.string(),
    expectedThreadId: z.number(),
    tx: txResultOutput,
  }),
  examples: [
    {
      options: {
        category: 'general',
        title: 'Roadmap discussion',
        body: 'Should we prioritize treasury automation in Q2?',
      },
      description: 'Post a new discussion thread',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const account = resolveAccount(c.env);

    const [activeMember, threadCountBefore] = (await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'isActive',
        args: [account.address],
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'threadCount',
      }),
    ])) as [boolean, bigint];

    if (!activeMember) {
      return c.error({
        code: 'NOT_ACTIVE_MEMBER',
        message: `Address ${toChecksum(account.address)} is not an active Assembly member.`,
        retryable: false,
      });
    }

    const expectedThreadId = Number(threadCountBefore) + 1;

    try {
      const txResult = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        abi: forumAbi,
        functionName: 'postDiscussionThread',
        args: [c.options.category, c.options.title, c.options.body],
      });

      return c.ok({
        author: toChecksum(account.address),
        category: c.options.category,
        title: c.options.title,
        expectedThreadId,
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      });
    } catch (error) {
      if (error instanceof TxError) {
        return c.error({
          code: error.code,
          message: error.message,
          retryable: error.code === 'NONCE_CONFLICT',
        });
      }
      throw error;
    }
  },
});

forum.command('post-comment', {
  description: 'Post a comment to a forum thread.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  args: z.object({
    threadId: z.coerce.number().int().positive().describe('Thread id to comment on'),
  }),
  options: writeOptions.extend({
    body: z.string().min(1).describe('Comment body'),
    'parent-id': z.coerce
      .number()
      .int()
      .nonnegative()
      .default(0)
      .describe('Optional parent comment id for threaded replies'),
  }),
  env: writeEnv,
  output: z.object({
    author: z.string(),
    threadId: z.number(),
    parentId: z.number(),
    expectedCommentId: z.number(),
    tx: txResultOutput,
  }),
  examples: [
    {
      args: { threadId: 1 },
      options: {
        body: 'Appreciate the update — support from me.',
      },
      description: 'Post a comment on thread #1',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const account = resolveAccount(c.env);

    const [activeMember, threadCount, commentCount] = (await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'isActive',
        args: [account.address],
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'threadCount',
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'commentCount',
      }),
    ])) as [boolean, bigint, bigint];

    if (!activeMember) {
      return c.error({
        code: 'NOT_ACTIVE_MEMBER',
        message: `Address ${toChecksum(account.address)} is not an active Assembly member.`,
        retryable: false,
      });
    }

    if (c.args.threadId > Number(threadCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Thread id ${c.args.threadId} does not exist (threadCount: ${threadCount})`,
        retryable: false,
      });
    }

    if (c.options['parent-id'] > Number(commentCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Parent comment id ${c.options['parent-id']} does not exist (commentCount: ${commentCount})`,
        retryable: false,
      });
    }

    const expectedCommentId = Number(commentCount) + 1;

    try {
      const txResult = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        abi: forumAbi,
        functionName: 'postComment',
        args: [BigInt(c.args.threadId), BigInt(c.options['parent-id']), c.options.body],
      });

      return c.ok({
        author: toChecksum(account.address),
        threadId: c.args.threadId,
        parentId: c.options['parent-id'],
        expectedCommentId,
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      });
    } catch (error) {
      if (error instanceof TxError) {
        return c.error({
          code: error.code,
          message: error.message,
          retryable: error.code === 'NONCE_CONFLICT',
        });
      }
      throw error;
    }
  },
});

forum.command('create-petition', {
  description: 'Create a new petition for community-initiated proposals.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  options: writeOptions.extend({
    title: z.string().min(1).describe('Petition title'),
    description: z.string().min(1).describe('Petition description'),
    kind: z.coerce.number().int().nonnegative().max(255).describe('Proposal kind enum value'),
    category: z.string().default('governance').describe('Forum category label for the petition'),
  }),
  env: writeEnv,
  output: z.object({
    proposer: z.string(),
    category: z.string(),
    kind: z.number(),
    title: z.string(),
    description: z.string(),
    expectedPetitionId: z.number(),
    expectedThreadId: z.number(),
    tx: txResultOutput,
  }),
  examples: [
    {
      options: {
        title: 'Expand treasury diversification',
        description: 'Propose allocating 5% of treasury to stablecoin reserves.',
        kind: 1,
        category: 'treasury',
      },
      description: 'Create a petition as an active Assembly member',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const account = resolveAccount(c.env);

    const [activeMember, petitionCountBefore, threadCountBefore] = (await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'isActive',
        args: [account.address],
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'petitionCount',
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'threadCount',
      }),
    ])) as [boolean, bigint, bigint];

    if (!activeMember) {
      return c.error({
        code: 'NOT_ACTIVE_MEMBER',
        message: `Address ${toChecksum(account.address)} is not an active Assembly member.`,
        retryable: false,
      });
    }

    const expectedPetitionId = Number(petitionCountBefore) + 1;
    const expectedThreadId = Number(threadCountBefore) + 1;

    const proposalInput = {
      kind: c.options.kind,
      title: c.options.title,
      description: c.options.description,
      intentSteps: [],
      intentConstraints: {
        deadline: 0,
        maxAllowedRiskTier: 0,
      },
      configUpdates: [],
    };

    try {
      const txResult = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        abi: forumAbi,
        functionName: 'createPetition',
        args: [c.options.category, proposalInput],
      });

      return c.ok(
        {
          proposer: toChecksum(account.address),
          category: c.options.category,
          kind: c.options.kind,
          title: c.options.title,
          description: c.options.description,
          expectedPetitionId,
          expectedThreadId,
          tx: txResult as FormattedTxResult | FormattedDryRunResult,
        },
        c.format === 'json' || c.format === 'jsonl'
          ? undefined
          : {
              cta: {
                description: 'Next steps:',
                commands: [
                  { command: 'forum petition', args: { id: String(expectedPetitionId) } },
                  {
                    command: 'forum sign-petition',
                    args: { petitionId: String(expectedPetitionId) },
                  },
                ],
              },
            },
      );
    } catch (error) {
      if (error instanceof TxError) {
        return c.error({
          code: error.code,
          message: error.message,
          retryable: error.code === 'NONCE_CONFLICT',
        });
      }
      throw error;
    }
  },
});

forum.command('sign-petition', {
  description: 'Sign an existing petition as an active member.',
  hint: 'Requires PRIVATE_KEY environment variable for signing.',
  args: z.object({
    petitionId: z.coerce.number().int().positive().describe('Petition id (1-indexed)'),
  }),
  options: writeOptions,
  env: writeEnv,
  output: z.object({
    signer: z.string(),
    petitionId: z.number(),
    expectedSignatures: z.number(),
    tx: txResultOutput,
  }),
  examples: [{ args: { petitionId: 1 }, description: 'Sign petition #1' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const account = resolveAccount(c.env);

    const [activeMember, petitionCount] = (await Promise.all([
      client.readContract({
        abi: registryAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.registry,
        functionName: 'isActive',
        args: [account.address],
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'petitionCount',
      }),
    ])) as [boolean, bigint];

    if (!activeMember) {
      return c.error({
        code: 'NOT_ACTIVE_MEMBER',
        message: `Address ${toChecksum(account.address)} is not an active Assembly member.`,
        retryable: false,
      });
    }

    if (c.args.petitionId > Number(petitionCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Petition id ${c.args.petitionId} does not exist (petitionCount: ${petitionCount})`,
        retryable: false,
      });
    }

    const [alreadySigned, petitionTuple] = (await Promise.all([
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'hasSignedPetition',
        args: [BigInt(c.args.petitionId), account.address],
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'petitions',
        args: [BigInt(c.args.petitionId)],
      }),
    ])) as [boolean, unknown];

    if (alreadySigned) {
      return c.error({
        code: 'ALREADY_SIGNED',
        message: `Address ${toChecksum(account.address)} has already signed petition #${c.args.petitionId}.`,
        retryable: false,
      });
    }

    const petition = decodePetition(petitionTuple);
    const expectedSignatures = petition.signatures + 1;

    try {
      const txResult = await assemblyWriteTx({
        env: c.env,
        options: c.options,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        abi: forumAbi,
        functionName: 'signPetition',
        args: [BigInt(c.args.petitionId)],
      });

      return c.ok({
        signer: toChecksum(account.address),
        petitionId: c.args.petitionId,
        expectedSignatures,
        tx: txResult as FormattedTxResult | FormattedDryRunResult,
      });
    } catch (error) {
      if (error instanceof TxError) {
        return c.error({
          code: error.code,
          message: error.message,
          retryable: error.code === 'NONCE_CONFLICT',
        });
      }
      throw error;
    }
  },
});

forum.command('petitions', {
  description: 'List petitions submitted in the forum contract.',
  env,
  output: z.array(z.record(z.string(), z.unknown())),
  examples: [{ description: 'List all petitions' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'petitionCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const petitionTuples = ids.length
      ? await client.multicall({
          allowFailure: false,
          contracts: ids.map((id) => ({
            abi: forumAbi,
            address: ABSTRACT_MAINNET_ADDRESSES.forum,
            functionName: 'petitions',
            args: [id] as const,
          })),
        })
      : [];
    const petitions = (petitionTuples as unknown[]).map(decodePetition);

    return c.ok(petitions.map((petition) => jsonSafe(petition) as Record<string, unknown>));
  },
});

forum.command('petition', {
  description: 'Get one petition plus whether proposer already signed it.',
  args: z.object({
    id: z.coerce.number().int().positive().describe('Petition id (1-indexed)'),
  }),
  env,
  output: z.object({ proposerSigned: z.boolean() }).passthrough(),
  examples: [{ args: { id: 1 }, description: 'Fetch petition #1' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const petitionCount = (await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'petitionCount',
    })) as bigint;

    if (c.args.id > Number(petitionCount)) {
      return c.error({
        code: 'OUT_OF_RANGE',
        message: `Petition id ${c.args.id} does not exist (petitionCount: ${petitionCount})`,
        retryable: false,
      });
    }

    const petition = decodePetition(
      await client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'petitions',
        args: [BigInt(c.args.id)],
      }),
    );
    const proposerSigned = (await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'hasSignedPetition',
      args: [BigInt(c.args.id), petition.proposer],
    })) as boolean;
    return c.ok({ ...(jsonSafe(petition) as Record<string, unknown>), proposerSigned });
  },
});

forum.command('has-signed', {
  description: 'Check whether an address signed a petition.',
  args: z.object({
    petitionId: z.coerce.number().int().positive().describe('Petition id (1-indexed)'),
    address: z.string().describe('Signer address to check'),
  }),
  env,
  output: z.object({
    petitionId: z.number(),
    address: z.string(),
    hasSigned: z.boolean(),
  }),
  examples: [
    {
      args: {
        petitionId: 1,
        address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
      },
      description: 'Check if an address signed petition #1',
    },
  ],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const hasSigned = (await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'hasSignedPetition',
      args: [BigInt(c.args.petitionId), c.args.address],
    })) as boolean;
    return c.ok({ petitionId: c.args.petitionId, address: toChecksum(c.args.address), hasSigned });
  },
});

forum.command('stats', {
  description: 'Read top-level forum counters and petition threshold.',
  env,
  output: z.object({
    threadCount: z.number(),
    commentCount: z.number(),
    petitionCount: z.number(),
    petitionThresholdBps: z.number(),
  }),
  examples: [{ description: 'Get forum counts and petition threshold' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [threadCount, commentCount, petitionCount, petitionThresholdBps] = (await Promise.all([
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'threadCount',
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'commentCount',
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'petitionCount',
      }),
      client.readContract({
        abi: forumAbi,
        address: ABSTRACT_MAINNET_ADDRESSES.forum,
        functionName: 'petitionThresholdBps',
      }),
    ])) as [bigint, bigint, bigint, bigint];
    return c.ok({
      threadCount: asNum(threadCount),
      commentCount: asNum(commentCount),
      petitionCount: asNum(petitionCount),
      petitionThresholdBps: asNum(petitionThresholdBps),
    });
  },
});
