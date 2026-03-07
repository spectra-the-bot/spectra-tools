import { createMockServer } from '@spectra-the-bot/cli-shared/testing';
import type { MockServer } from '@spectra-the-bot/cli-shared/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CouncilMember, ForumPost, Member, Proposal, VoteRecord, VoteTally } from '../api.js';

interface OutputEnvelope {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

async function runCli(
  argv: string[],
  server: MockServer,
  env: Partial<Record<'ASSEMBLY_API_URL' | 'ASSEMBLY_API_KEY', string>> = {},
): Promise<{ lines: string[]; exitCode: number | undefined }> {
  // Set env so the CLI points to our mock server
  vi.stubEnv('ASSEMBLY_API_URL', env.ASSEMBLY_API_URL ?? server.url);
  vi.stubEnv('ASSEMBLY_API_KEY', env.ASSEMBLY_API_KEY ?? '');

  // Dynamically import the CLI fresh each time
  const { cli } = await import('../cli.js');

  const lines: string[] = [];
  let exitCode: number | undefined;

  await cli.serve([...argv, '--format', 'json', '--verbose'], {
    stdout: (s) => lines.push(s),
    exit: (code) => {
      exitCode = code;
    },
  });

  return { lines, exitCode };
}

function parseOutput(lines: string[]): OutputEnvelope {
  const json = lines.find((l) => l.trim().startsWith('{'));
  if (!json) return { ok: false, error: { code: 'NO_OUTPUT', message: 'No JSON output' } };
  return JSON.parse(json) as OutputEnvelope;
}

describe('assembly CLI', () => {
  let server: MockServer;

  beforeEach(async () => {
    server = await createMockServer();
    vi.resetModules();
  });

  afterEach(async () => {
    await server.close();
    vi.unstubAllEnvs();
  });

  describe('proposals list', () => {
    it('returns proposals on success', async () => {
      const mockProposals: Proposal[] = [
        {
          id: '1',
          title: 'Test Proposal',
          status: 'active',
          description: 'A test proposal',
          votesFor: 50,
          votesAgainst: 10,
          votesAbstain: 2,
          startTime: 1700000000,
          endTime: 1700086400,
          proposer: '0xabc',
        },
      ];
      server.addRoute('GET', '/v1/proposals', { body: mockProposals });
      const { lines } = await runCli(['proposals', 'list'], server);
      const output = parseOutput(lines);
      expect(output.ok).toBe(true);
      expect(Array.isArray(output.data)).toBe(true);
    });

    it('passes status filter to API', async () => {
      server.addRoute('GET', '/v1/proposals', { body: [] });
      await runCli(['proposals', 'list', '--status', 'active'], server);
      expect(server.requests[0]?.url).toContain('status=active');
    });

    it('passes API key header when configured', async () => {
      server.addRoute('GET', '/v1/proposals', { body: [] });
      await runCli(['proposals', 'list'], server, { ASSEMBLY_API_KEY: 'test-api-key' });
      expect(server.requests[0]?.headers['x-api-key']).toBe('test-api-key');
    });
  });

  describe('proposals get', () => {
    it('returns proposal details', async () => {
      const mockProposal: Proposal = {
        id: '42',
        title: 'Test Proposal 42',
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
      const { lines } = await runCli(['proposals', 'get', '42'], server);
      const output = parseOutput(lines);
      expect(output.ok).toBe(true);
    });
  });

  describe('council members', () => {
    it('returns council members', async () => {
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
      const { lines } = await runCli(['council', 'members'], server);
      const output = parseOutput(lines);
      expect(output.ok).toBe(true);
    });
  });

  describe('forum posts', () => {
    it('returns forum posts', async () => {
      const mockPosts: ForumPost[] = [
        {
          id: 'post-1',
          title: 'Governance Post',
          category: 'governance',
          author: '0xabc',
          createdAt: 1700000000,
          excerpt: 'Discussion...',
        },
      ];
      server.addRoute('GET', '/v1/forum/posts', { body: mockPosts });
      const { lines } = await runCli(['forum', 'posts'], server);
      const output = parseOutput(lines);
      expect(output.ok).toBe(true);
    });
  });

  describe('members list', () => {
    it('returns members', async () => {
      const mockMembers: Member[] = [
        { address: '0xabc', role: 'voter', joinedAt: 1700000000, votingPower: 100 },
      ];
      server.addRoute('GET', '/v1/members', { body: mockMembers });
      const { lines } = await runCli(['members', 'list'], server);
      const output = parseOutput(lines);
      expect(output.ok).toBe(true);
    });
  });

  describe('votes history', () => {
    it('returns vote history', async () => {
      const mockVotes: VoteRecord[] = [
        { proposalId: '1', voter: '0xabc', vote: 'for', timestamp: 1700000000 },
      ];
      server.addRoute('GET', '/v1/votes', { body: mockVotes });
      const { lines } = await runCli(['votes', 'history'], server);
      const output = parseOutput(lines);
      expect(output.ok).toBe(true);
    });
  });

  describe('votes tally', () => {
    it('returns vote tally with breakdown', async () => {
      const mockTally: VoteTally = {
        proposalId: '1',
        votesFor: 60,
        votesAgainst: 30,
        votesAbstain: 10,
        totalVotes: 100,
      };
      server.addRoute('GET', '/v1/votes/tally/1', { body: mockTally });
      const { lines } = await runCli(['votes', 'tally', '1'], server);
      const output = parseOutput(lines);
      expect(output.ok).toBe(true);
    });
  });
});
