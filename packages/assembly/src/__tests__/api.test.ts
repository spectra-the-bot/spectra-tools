import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMockServer } from '@spectra-the-bot/cli-shared/testing';
import type { MockServer } from '@spectra-the-bot/cli-shared/testing';
import { createAssemblyClient } from '../api.js';
import type { Proposal, CouncilMember, ForumPost, Member, VoteRecord, VoteTally } from '../api.js';

describe('createAssemblyClient', () => {
  let server: MockServer;
  let client: ReturnType<typeof createAssemblyClient>;

  beforeEach(async () => {
    server = await createMockServer();
    client = createAssemblyClient(server.url);
  });

  afterEach(async () => {
    await server.close();
  });

  describe('proposals', () => {
    it('lists proposals', async () => {
      const mockProposals: Proposal[] = [
        {
          id: '1',
          title: 'Proposal 1',
          status: 'active',
          description: 'Test proposal',
          votesFor: 100,
          votesAgainst: 20,
          votesAbstain: 5,
          startTime: 1700000000,
          endTime: 1700086400,
          proposer: '0xabc',
        },
      ];
      server.addRoute('GET', '/v1/proposals', { body: mockProposals });
      const result = await client.proposals.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('1');
    });

    it('lists proposals with status filter', async () => {
      server.addRoute('GET', '/v1/proposals', { body: [] });
      await client.proposals.list('active');
      expect(server.requests[0]?.url).toContain('status=active');
    });

    it('gets a single proposal', async () => {
      const mockProposal: Proposal = {
        id: '42',
        title: 'Proposal 42',
        status: 'passed',
        description: 'Passed proposal',
        votesFor: 200,
        votesAgainst: 10,
        votesAbstain: 3,
        startTime: 1700000000,
        endTime: 1700086400,
        proposer: '0xdef',
      };
      server.addRoute('GET', '/v1/proposals/42', { body: mockProposal });
      const result = await client.proposals.get('42');
      expect(result.id).toBe('42');
      expect(result.status).toBe('passed');
    });

    it('submits a vote', async () => {
      server.addRoute('POST', '/v1/proposals/1/vote', {
        status: 200,
        body: { success: true },
      });
      const result = await client.proposals.vote('1', 'for', 'Great proposal');
      expect(result.success).toBe(true);
      const body = JSON.parse(server.requests[0]?.body ?? '{}') as {
        vote: string;
        reason: string;
      };
      expect(body.vote).toBe('for');
      expect(body.reason).toBe('Great proposal');
    });
  });

  describe('council', () => {
    it('lists council members', async () => {
      const mockMembers: CouncilMember[] = [
        {
          address: '0xabc',
          name: 'Alice',
          status: 'active',
          seatNumber: 1,
          joinedAt: 1700000000,
        },
      ];
      server.addRoute('GET', '/v1/council/members', { body: mockMembers });
      const result = await client.council.members();
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Alice');
    });

    it('gets council member info', async () => {
      const mockMember: CouncilMember = {
        address: '0xabc',
        name: 'Alice',
        status: 'active',
        seatNumber: 1,
        joinedAt: 1700000000,
      };
      server.addRoute('GET', '/v1/council/members/0xabc', { body: mockMember });
      const result = await client.council.info('0xabc');
      expect(result.address).toBe('0xabc');
    });

    it('lists council seats', async () => {
      server.addRoute('GET', '/v1/council/seats', {
        body: [{ seatNumber: 1, status: 'filled', holder: '0xabc' }],
      });
      const result = await client.council.seats();
      expect(result).toHaveLength(1);
      expect(result[0]?.status).toBe('filled');
    });
  });

  describe('forum', () => {
    it('lists forum posts', async () => {
      const mockPosts: ForumPost[] = [
        {
          id: 'post-1',
          title: 'Governance Discussion',
          category: 'governance',
          author: '0xabc',
          createdAt: 1700000000,
          excerpt: 'Let us discuss...',
        },
      ];
      server.addRoute('GET', '/v1/forum/posts', { body: mockPosts });
      const result = await client.forum.posts();
      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Governance Discussion');
    });

    it('gets a single post', async () => {
      const mockPost: ForumPost = {
        id: 'post-1',
        title: 'Governance Discussion',
        category: 'governance',
        author: '0xabc',
        createdAt: 1700000000,
        excerpt: 'Let us discuss...',
      };
      server.addRoute('GET', '/v1/forum/posts/post-1', { body: mockPost });
      const result = await client.forum.post('post-1');
      expect(result.id).toBe('post-1');
    });

    it('searches forum posts', async () => {
      server.addRoute('GET', '/v1/forum/search', { body: [] });
      await client.forum.search('governance token');
      expect(server.requests[0]?.url).toContain('q=governance%20token');
    });
  });

  describe('members', () => {
    it('lists members', async () => {
      const mockMembers: Member[] = [
        { address: '0xabc', role: 'voter', joinedAt: 1700000000, votingPower: 100 },
      ];
      server.addRoute('GET', '/v1/members', { body: mockMembers });
      const result = await client.members.list();
      expect(result).toHaveLength(1);
      expect(result[0]?.role).toBe('voter');
    });

    it('gets member info', async () => {
      const mockMember: Member = {
        address: '0xabc',
        role: 'council',
        joinedAt: 1700000000,
        votingPower: 1000,
      };
      server.addRoute('GET', '/v1/members/0xabc', { body: mockMember });
      const result = await client.members.info('0xabc');
      expect(result.role).toBe('council');
    });
  });

  describe('votes', () => {
    it('fetches vote history', async () => {
      const mockVotes: VoteRecord[] = [
        {
          proposalId: '1',
          voter: '0xabc',
          vote: 'for',
          timestamp: 1700000000,
        },
      ];
      server.addRoute('GET', '/v1/votes', { body: mockVotes });
      const result = await client.votes.history();
      expect(result).toHaveLength(1);
      expect(result[0]?.vote).toBe('for');
    });

    it('fetches vote tally', async () => {
      const mockTally: VoteTally = {
        proposalId: '42',
        votesFor: 150,
        votesAgainst: 30,
        votesAbstain: 10,
        totalVotes: 190,
      };
      server.addRoute('GET', '/v1/votes/tally/42', { body: mockTally });
      const result = await client.votes.tally('42');
      expect(result.totalVotes).toBe(190);
    });
  });
});
