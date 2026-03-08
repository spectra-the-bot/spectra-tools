import { Cli, z } from 'incur';
import { forumAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, relTime, toChecksum } from './_common.js';

const env = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
});

export const forum = Cli.create('forum', {
  description: 'Browse Assembly forum threads, comments, and petitions.',
});

forum.command('threads', {
  description: 'List forum threads with author and creation metadata.',
  env,
  output: z.array(
    z.object({
      id: z.number(),
      kind: z.number(),
      author: z.string(),
      createdAt: z.number(),
      createdAtRelative: z.string(),
      category: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
    }),
  ),
  examples: [{ description: 'List all forum threads' }],
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'threadCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const items = (
      ids.length
        ? await client.multicall({
            allowFailure: false,
            contracts: ids.map((id) => ({
              abi: forumAbi,
              address: ABSTRACT_MAINNET_ADDRESSES.forum,
              functionName: 'threads',
              args: [id] as const,
            })),
          })
        : []
    ) as Array<Record<string, unknown>>;
    return c.ok(
      items.map((x: Record<string, unknown>) => ({
        id: asNum(x.id as bigint),
        kind: asNum(x.kind as bigint),
        author: toChecksum(x.author as string),
        createdAt: asNum(x.createdAt as bigint),
        createdAtRelative: relTime(x.createdAt as bigint),
        category: (x.category as string | undefined) ?? null,
        title: (x.title as string | undefined) ?? null,
      })),
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
    const [thread, commentCount] = (await Promise.all([
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
    ])) as [Record<string, unknown>, bigint];
    const ids = Array.from({ length: Number(commentCount) }, (_, i) => BigInt(i + 1));
    const comments = (
      ids.length
        ? await client.multicall({
            allowFailure: false,
            contracts: ids.map((id) => ({
              abi: forumAbi,
              address: ABSTRACT_MAINNET_ADDRESSES.forum,
              functionName: 'comments',
              args: [id] as const,
            })),
          })
        : []
    ) as Array<Record<string, unknown>>;
    return c.ok({
      thread,
      comments: comments.filter((x) => Number(x.threadId) === c.args.id),
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
    const comments = (
      ids.length
        ? await client.multicall({
            allowFailure: false,
            contracts: ids.map((id) => ({
              abi: forumAbi,
              address: ABSTRACT_MAINNET_ADDRESSES.forum,
              functionName: 'comments',
              args: [id] as const,
            })),
          })
        : []
    ) as Array<Record<string, unknown>>;
    return c.ok(comments.filter((x) => Number(x.threadId) === c.args.threadId));
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
    const comment = (await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'comments',
      args: [BigInt(c.args.id)],
    })) as Record<string, unknown>;
    return c.ok(comment);
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
    const petitions = (
      ids.length
        ? await client.multicall({
            allowFailure: false,
            contracts: ids.map((id) => ({
              abi: forumAbi,
              address: ABSTRACT_MAINNET_ADDRESSES.forum,
              functionName: 'petitions',
              args: [id] as const,
            })),
          })
        : []
    ) as Array<Record<string, unknown>>;
    return c.ok(petitions);
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
    const petition = (await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'petitions',
      args: [BigInt(c.args.id)],
    })) as { proposer: string };
    const proposerSigned = (await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'hasSignedPetition',
      args: [BigInt(c.args.id), petition.proposer],
    })) as boolean;
    return c.ok({ ...petition, proposerSigned });
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
