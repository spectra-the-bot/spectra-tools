import type { Address } from 'viem';
import { asNum, jsonSafe, toChecksum } from '../commands/_common.js';
import { forumAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import type { createAssemblyPublicClient } from '../contracts/client.js';

type AssemblyClient = ReturnType<typeof createAssemblyPublicClient>;

export type ThreadTuple = readonly [
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
export type CommentTuple = readonly [bigint, bigint, bigint, string, bigint, string];
export type PetitionTuple = readonly [
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

export type DecodedThread = {
  id: number;
  kind: number;
  author: string;
  createdAt: number;
  category: string;
  title: string;
  body: string;
  proposalId: number;
  petitionId: number;
};

export type DecodedComment = {
  id: number;
  threadId: number;
  parentId: number;
  author: string;
  createdAt: number;
  body: string;
};

export type DecodedPetition = {
  id: number;
  proposer: string;
  createdAt: number;
  category: string;
  title: string;
  body: string;
  signatures: number;
  promoted: boolean;
  threadId: number;
  proposalInput: unknown;
};

export function decodeThread(value: unknown): DecodedThread {
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

export function decodeComment(value: unknown): DecodedComment {
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

export function decodePetition(value: unknown): DecodedPetition {
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

export async function fetchAllThreads(client: AssemblyClient): Promise<DecodedThread[]> {
  const count = (await client.readContract({
    abi: forumAbi,
    address: ABSTRACT_MAINNET_ADDRESSES.forum,
    functionName: 'threadCount',
  })) as bigint;

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  if (ids.length === 0) return [];

  const threadTuples = await client.multicall({
    allowFailure: false,
    contracts: ids.map((id) => ({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'threads',
      args: [id] as const,
    })),
  });

  return (threadTuples as unknown[]).map(decodeThread);
}

export async function fetchAllComments(client: AssemblyClient): Promise<DecodedComment[]> {
  const count = (await client.readContract({
    abi: forumAbi,
    address: ABSTRACT_MAINNET_ADDRESSES.forum,
    functionName: 'commentCount',
  })) as bigint;

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  if (ids.length === 0) return [];

  const commentTuples = await client.multicall({
    allowFailure: false,
    contracts: ids.map((id) => ({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'comments',
      args: [id] as const,
    })),
  });

  return (commentTuples as unknown[]).map(decodeComment);
}

export async function fetchAllPetitions(client: AssemblyClient): Promise<DecodedPetition[]> {
  const count = (await client.readContract({
    abi: forumAbi,
    address: ABSTRACT_MAINNET_ADDRESSES.forum,
    functionName: 'petitionCount',
  })) as bigint;

  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  if (ids.length === 0) return [];

  const petitionTuples = await client.multicall({
    allowFailure: false,
    contracts: ids.map((id) => ({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'petitions',
      args: [id] as const,
    })),
  });

  return (petitionTuples as unknown[]).map(decodePetition);
}

export async function fetchForumStats(client: AssemblyClient): Promise<{
  threadCount: number;
  commentCount: number;
  petitionCount: number;
  petitionThresholdBps: number;
}> {
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

  return {
    threadCount: asNum(threadCount),
    commentCount: asNum(commentCount),
    petitionCount: asNum(petitionCount),
    petitionThresholdBps: asNum(petitionThresholdBps),
  };
}

/**
 * Batch-check whether an address has signed each of the given petition IDs.
 * Uses a single multicall for all checks. Returns an empty map (without RPC call)
 * when petitionIds is empty.
 */
export async function fetchHasSignedBatch(
  client: AssemblyClient,
  address: Address,
  petitionIds: number[],
): Promise<Map<number, boolean>> {
  if (petitionIds.length === 0) return new Map();

  const results = await client.multicall({
    allowFailure: false,
    contracts: petitionIds.map((id) => ({
      abi: forumAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.forum,
      functionName: 'hasSignedPetition' as const,
      args: [BigInt(id), address] as const,
    })),
  });

  const map = new Map<number, boolean>();
  for (let i = 0; i < petitionIds.length; i++) {
    map.set(petitionIds[i], results[i] as boolean);
  }
  return map;
}
