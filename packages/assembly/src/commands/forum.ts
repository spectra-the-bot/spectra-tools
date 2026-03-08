import { Cli, z } from 'incur';
import { forumAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, jsonSafe, relTime, timeValue, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
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
      {
        cta: {
          description: 'Inspect or comment:',
          commands: [
            { command: 'forum thread', args: { id: '<id>' } },
            { command: 'forum post-comment', args: { id: '<id>' } },
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
  description: 'Get one comment by comment id.',
  args: z.object({
    id: z.coerce.number().int().positive().describe('Comment id (1-indexed)'),
  }),
  env,
  output: z.record(z.string(), z.unknown()),
  examples: [{ args: { id: 1 }, description: 'Fetch comment #1' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
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
