import { Cli, z } from 'incur';
import { ASSEMBLY_BASE_URL, createAssemblyClient } from '../api.js';

function getClient() {
  const baseUrl = process.env.ABSTRACT_RPC_URL ?? ASSEMBLY_BASE_URL;
  const apiKey = process.env.ASSEMBLY_API_KEY;
  return createAssemblyClient(baseUrl, apiKey);
}

export const votes = Cli.create('votes', {
  description: 'View voting history and tallies for Assembly governance.',
});

votes.command('history', {
  description: 'View voting history.',
  options: z.object({
    voter: z.string().optional().describe('Filter by voter address'),
    proposal: z.string().optional().describe('Filter by proposal ID'),
  }),
  examples: [
    { description: 'View all vote history' },
    { options: { voter: '0xabc123' }, description: 'View votes by a specific address' },
    { options: { proposal: '42' }, description: 'View all votes on proposal #42' },
  ],
  run(c) {
    const client = getClient();
    return client.votes
      .history(c.options.voter, c.options.proposal)
      .then((data) =>
        c.ok(
          data.map((v) => ({
            proposalId: v.proposalId,
            voter: v.voter,
            vote: v.vote,
            reason: v.reason,
            timestamp: new Date(v.timestamp * 1000).toISOString(),
          })),
          {
            cta: {
              description: 'View vote tally for a proposal:',
              commands: [{ command: 'votes tally', args: { proposalId: '<id>' } }],
            },
          },
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch vote history: ${message}`,
          retryable: true,
        });
      });
  },
});

votes.command('tally', {
  description: 'Get the vote tally for a proposal.',
  args: z.object({
    proposalId: z.string().describe('Proposal ID to tally votes for'),
  }),
  examples: [{ args: { proposalId: '42' }, description: 'Get vote tally for proposal #42' }],
  run(c) {
    const client = getClient();
    return client.votes
      .tally(c.args.proposalId)
      .then((data) => {
        const total = data.totalVotes;
        const pct = (n: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%');
        return c.ok(
          {
            proposalId: data.proposalId,
            votesFor: data.votesFor,
            votesAgainst: data.votesAgainst,
            votesAbstain: data.votesAbstain,
            totalVotes: data.totalVotes,
            breakdown: {
              for: pct(data.votesFor),
              against: pct(data.votesAgainst),
              abstain: pct(data.votesAbstain),
            },
          },
          {
            cta: {
              description: 'View full proposal details:',
              commands: [{ command: 'proposals get', args: { id: c.args.proposalId } }],
            },
          },
        );
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch vote tally for ${c.args.proposalId}: ${message}`,
          retryable: true,
        });
      });
  },
});
