import { createHttpClient } from '@spectra-the-bot/cli-shared';

export const ASSEMBLY_BASE_URL = 'https://api.assembly.abs.xyz';

export interface Proposal {
  id: string;
  title: string;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  description: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  startTime: number;
  endTime: number;
  proposer: string;
}

export interface CouncilMember {
  address: string;
  name: string;
  status: 'active' | 'inactive';
  seatNumber: number;
  joinedAt: number;
}

export interface CouncilSeat {
  seatNumber: number;
  status: 'open' | 'filled';
  holder?: string;
}

export interface ForumPost {
  id: string;
  title: string;
  category: 'governance' | 'general';
  author: string;
  createdAt: number;
  excerpt: string;
}

export interface Member {
  address: string;
  role: 'council' | 'voter';
  joinedAt: number;
  votingPower?: number;
}

export interface VoteRecord {
  proposalId: string;
  voter: string;
  vote: 'for' | 'against' | 'abstain';
  reason?: string;
  timestamp: number;
}

export interface VoteTally {
  proposalId: string;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalVotes: number;
}

export function createAssemblyClient(baseUrl: string, apiKey?: string) {
  const client = createHttpClient({
    baseUrl,
    defaultHeaders: apiKey ? { 'X-Api-Key': apiKey } : {},
  });

  return {
    proposals: {
      list: (status?: string) =>
        client.request<Proposal[]>('/v1/proposals', {
          query: status && status !== 'all' ? { status } : {},
        }),
      get: (id: string) => client.request<Proposal>(`/v1/proposals/${id}`),
      vote: (id: string, vote: string, reason?: string) =>
        client.request<{ success: boolean }>(`/v1/proposals/${id}/vote`, {
          method: 'POST',
          body: { vote, reason },
        }),
    },
    council: {
      members: (status?: string) =>
        client.request<CouncilMember[]>('/v1/council/members', {
          query: status ? { status } : {},
        }),
      info: (address: string) =>
        client.request<CouncilMember>(`/v1/council/members/${address}`),
      seats: (status?: string) =>
        client.request<CouncilSeat[]>('/v1/council/seats', {
          query: status ? { status } : {},
        }),
    },
    forum: {
      posts: (category?: string) =>
        client.request<ForumPost[]>('/v1/forum/posts', {
          query: category ? { category } : {},
        }),
      post: (id: string) => client.request<ForumPost>(`/v1/forum/posts/${id}`),
      search: (query: string) =>
        client.request<ForumPost[]>('/v1/forum/search', { query: { q: query } }),
    },
    members: {
      list: (role?: string) =>
        client.request<Member[]>('/v1/members', {
          query: role && role !== 'all' ? { role } : {},
        }),
      info: (address: string) =>
        client.request<Member>(`/v1/members/${address}`),
      status: (address: string) =>
        client.request<Member>(`/v1/members/${address}/status`),
    },
    votes: {
      history: (voter?: string, proposalId?: string) =>
        client.request<VoteRecord[]>('/v1/votes', {
          query: { voter, proposalId },
        }),
      tally: (proposalId: string) =>
        client.request<VoteTally>(`/v1/votes/tally/${proposalId}`),
    },
  };
}
