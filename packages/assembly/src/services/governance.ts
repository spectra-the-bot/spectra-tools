import type { Address } from 'viem';
import { asNum, toChecksum } from '../commands/_common.js';
import { governanceAbi } from '../contracts/abis.js';
import { ABSTRACT_MAINNET_ADDRESSES } from '../contracts/addresses.js';
import type { createAssemblyPublicClient } from '../contracts/client.js';

type AssemblyClient = ReturnType<typeof createAssemblyPublicClient>;

export type ProposalTuple = readonly [
  bigint,
  bigint,
  bigint,
  bigint,
  string,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean,
  bigint,
  bigint,
  string,
  string,
];

export type DecodedProposal = {
  kind: bigint;
  configRiskTier: bigint;
  origin: bigint;
  status: bigint;
  proposer: string;
  threadId: bigint;
  petitionId: bigint;
  createdAt: bigint;
  deliberationEndsAt: bigint;
  voteStartAt: bigint;
  voteEndAt: bigint;
  timelockEndsAt: bigint;
  activeSeatsSnapshot: bigint;
  forVotes: bigint;
  againstVotes: bigint;
  abstainVotes: bigint;
  amount: bigint;
  snapshotAssetBalance: bigint;
  transferIntent: boolean;
  intentDeadline: bigint;
  intentMaxRiskTier: bigint;
  title: string;
  description: string;
};

export type ProposalOutput = {
  kind: number;
  configRiskTier: number;
  origin: number;
  status: string;
  statusCode: number;
  proposer: string;
  threadId: number;
  petitionId: number;
  createdAt: number;
  deliberationEndsAt: number;
  voteStartAt: number;
  voteEndAt: number;
  timelockEndsAt: number;
  activeSeatsSnapshot: number;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  amount: string;
  snapshotAssetBalance: string;
  transferIntent: boolean;
  intentDeadline: number;
  intentMaxRiskTier: number;
  title: string;
  description: string;
};

// Derived from verified Governance.sol source on Abstract mainnet:
// enum ProposalStatus { Deliberation, Voting, Timelock, Executed, Defeated, Cancelled }
export const proposalStatusLabels: Record<number, string> = {
  0: 'pending',
  1: 'active',
  2: 'passed',
  3: 'executed',
  4: 'defeated',
  5: 'cancelled',
};

export function proposalStatus(status: bigint): { status: string; statusCode: number } {
  const statusCode = asNum(status);
  return {
    status: proposalStatusLabels[statusCode] ?? `unknown-${statusCode}`,
    statusCode,
  };
}

export function decodeProposal(value: unknown): DecodedProposal {
  const [
    kind,
    configRiskTier,
    origin,
    status,
    proposer,
    threadId,
    petitionId,
    createdAt,
    deliberationEndsAt,
    voteStartAt,
    voteEndAt,
    timelockEndsAt,
    activeSeatsSnapshot,
    forVotes,
    againstVotes,
    abstainVotes,
    amount,
    snapshotAssetBalance,
    transferIntent,
    intentDeadline,
    intentMaxRiskTier,
    title,
    description,
  ] = value as ProposalTuple;

  return {
    kind,
    configRiskTier,
    origin,
    status,
    proposer: toChecksum(proposer),
    threadId,
    petitionId,
    createdAt,
    deliberationEndsAt,
    voteStartAt,
    voteEndAt,
    timelockEndsAt,
    activeSeatsSnapshot,
    forVotes,
    againstVotes,
    abstainVotes,
    amount,
    snapshotAssetBalance,
    transferIntent,
    intentDeadline,
    intentMaxRiskTier,
    title,
    description,
  };
}

export function serializeProposal(proposal: DecodedProposal): ProposalOutput {
  const status = proposalStatus(proposal.status);

  return {
    kind: asNum(proposal.kind),
    configRiskTier: asNum(proposal.configRiskTier),
    origin: asNum(proposal.origin),
    status: status.status,
    statusCode: status.statusCode,
    proposer: proposal.proposer,
    threadId: asNum(proposal.threadId),
    petitionId: asNum(proposal.petitionId),
    createdAt: asNum(proposal.createdAt),
    deliberationEndsAt: asNum(proposal.deliberationEndsAt),
    voteStartAt: asNum(proposal.voteStartAt),
    voteEndAt: asNum(proposal.voteEndAt),
    timelockEndsAt: asNum(proposal.timelockEndsAt),
    activeSeatsSnapshot: asNum(proposal.activeSeatsSnapshot),
    forVotes: proposal.forVotes.toString(),
    againstVotes: proposal.againstVotes.toString(),
    abstainVotes: proposal.abstainVotes.toString(),
    amount: proposal.amount.toString(),
    snapshotAssetBalance: proposal.snapshotAssetBalance.toString(),
    transferIntent: proposal.transferIntent,
    intentDeadline: asNum(proposal.intentDeadline),
    intentMaxRiskTier: asNum(proposal.intentMaxRiskTier),
    title: proposal.title,
    description: proposal.description,
  };
}

export async function fetchProposalCount(client: AssemblyClient): Promise<bigint> {
  return (await client.readContract({
    abi: governanceAbi,
    address: ABSTRACT_MAINNET_ADDRESSES.governance,
    functionName: 'proposalCount',
  })) as bigint;
}

export async function fetchProposalById(
  client: AssemblyClient,
  id: number,
): Promise<DecodedProposal> {
  return decodeProposal(
    await client.readContract({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposals',
      args: [BigInt(id)],
    }),
  );
}

export async function fetchAllProposals(client: AssemblyClient): Promise<DecodedProposal[]> {
  const count = await fetchProposalCount(client);
  const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
  if (ids.length === 0) return [];

  const proposalTuples = await client.multicall({
    allowFailure: false,
    contracts: ids.map((id) => ({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'proposals',
      args: [id] as const,
    })),
  });

  return (proposalTuples as unknown[]).map(decodeProposal);
}

/**
 * Batch-check whether an address has voted on each of the given proposal IDs.
 * Uses a single multicall for all checks. Returns an empty map (without RPC call)
 * when proposalIds is empty.
 */
export async function fetchHasVotedBatch(
  client: AssemblyClient,
  address: Address,
  proposalIds: number[],
): Promise<Map<number, boolean>> {
  if (proposalIds.length === 0) return new Map();

  const results = await client.multicall({
    allowFailure: false,
    contracts: proposalIds.map((id) => ({
      abi: governanceAbi,
      address: ABSTRACT_MAINNET_ADDRESSES.governance,
      functionName: 'hasVoted' as const,
      args: [BigInt(id), address] as const,
    })),
  });

  const map = new Map<number, boolean>();
  for (let i = 0; i < proposalIds.length; i++) {
    map.set(proposalIds[i], results[i] as boolean);
  }
  return map;
}
