import { Cli, z } from 'incur';
import { forumAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import { createAssemblyPublicClient } from '../contracts/client.js';
import { asNum, relTime, toChecksum } from './_common.js';

const env = z.object({ ABSTRACT_RPC_URL: z.string().optional() });
export const forum = Cli.create('forum', { description: 'Read forum threads/comments/petitions.' });

forum.command('threads', {
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'threadCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const items = ids.length
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
    return c.ok(
      items.map((x: Record<string, unknown>) => ({
        id: asNum(x.id),
        kind: asNum(x.kind),
        author: toChecksum(x.author),
        createdAt: asNum(x.createdAt),
        createdAtRelative: relTime(x.createdAt),
        category: x.category,
        title: x.title,
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
  args: z.object({ id: z.coerce.number().int().positive() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [thread, commentCount] = await Promise.all([
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
    ]);
    const ids = Array.from({ length: Number(commentCount) }, (_, i) => BigInt(i + 1));
    const comments = ids.length
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
    return c.ok({
      thread,
      comments: comments.filter((x: Record<string, unknown>) => Number(x.threadId) === c.args.id),
    });
  },
});

forum.command('comments', {
  args: z.object({ threadId: z.coerce.number().int().positive() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'commentCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const comments = ids.length
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
    return c.ok(
      comments.filter((x: Record<string, unknown>) => Number(x.threadId) === c.args.threadId),
    );
  },
});

forum.command('comment', {
  args: z.object({ id: z.coerce.number().int().positive() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const comment = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'comments',
      args: [BigInt(c.args.id)],
    });
    return c.ok(comment);
  },
});

forum.command('petitions', {
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const count = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'petitionCount',
    });
    const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
    const petitions = ids.length
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
    return c.ok(petitions);
  },
});

forum.command('petition', {
  args: z.object({ id: z.coerce.number().int().positive() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const petition = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'petitions',
      args: [BigInt(c.args.id)],
    });
    const proposerSigned = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'hasSignedPetition',
      args: [BigInt(c.args.id), petition.proposer],
    });
    return c.ok({ ...petition, proposerSigned });
  },
});

forum.command('has-signed', {
  args: z.object({ petitionId: z.coerce.number().int().positive(), address: z.string() }),
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const hasSigned = await client.readContract({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'hasSignedPetition',
      args: [BigInt(c.args.petitionId), c.args.address],
    });
    return c.ok({ petitionId: c.args.petitionId, address: toChecksum(c.args.address), hasSigned });
  },
});

forum.command('stats', {
  env,
  async run(c) {
    const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
    const [threadCount, commentCount, petitionCount, petitionThresholdBps] = await Promise.all([
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
    ]);
    return c.ok({
      threadCount: asNum(threadCount),
      commentCount: asNum(commentCount),
      petitionCount: asNum(petitionCount),
      petitionThresholdBps: asNum(petitionThresholdBps),
    });
  },
});
