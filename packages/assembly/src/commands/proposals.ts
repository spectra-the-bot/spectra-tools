import { Cli, z } from 'incur';
import type { Proposal } from '../api.js';
import { ASSEMBLY_BASE_URL, createAssemblyClient } from '../api.js';

const assemblyEnv = z.object({
  ASSEMBLY_API_URL: z.string().optional().describe('Assembly API URL'),
  ASSEMBLY_API_KEY: z.string().optional().describe('Assembly API key'),
});

type AssemblyEnv = z.infer<typeof assemblyEnv>;

function getClient(env: AssemblyEnv) {
  const apiUrl = env.ASSEMBLY_API_URL ?? ASSEMBLY_BASE_URL;
  const apiKey = env.ASSEMBLY_API_KEY;
  return createAssemblyClient(apiUrl, apiKey);
}

function formatProposal(p: Proposal) {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    proposer: p.proposer,
    votes: {
      for: p.votesFor,
      against: p.votesAgainst,
      abstain: p.votesAbstain,
    },
    startTime: new Date(p.startTime * 1000).toISOString(),
    endTime: new Date(p.endTime * 1000).toISOString(),
  };
}

export const proposals = Cli.create('proposals', {
  description: 'Manage Assembly governance proposals.',
});

proposals.command('list', {
  description: 'List governance proposals.',
  options: z.object({
    status: z
      .enum(['active', 'passed', 'rejected', 'all'])
      .optional()
      .default('all')
      .describe('Filter proposals by status'),
  }),
  env: assemblyEnv,
  examples: [
    { description: 'List all proposals' },
    { options: { status: 'active' }, description: 'List active proposals' },
  ],
  run(c) {
    const client = getClient(c.env);
    return client.proposals
      .list(c.options.status)
      .then((data) =>
        c.ok(data.map(formatProposal), {
          cta: {
            description: 'View a proposal:',
            commands: [{ command: 'proposals get', args: { id: '<id>' } }],
          },
        }),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch proposals: ${message}`,
          retryable: true,
        });
      });
  },
});

proposals.command('get', {
  description: 'Get details of a governance proposal.',
  args: z.object({
    id: z.string().describe('Proposal ID'),
  }),
  env: assemblyEnv,
  examples: [{ args: { id: '42' }, description: 'Get proposal #42' }],
  run(c) {
    const client = getClient(c.env);
    return client.proposals
      .get(c.args.id)
      .then((data) =>
        c.ok(
          { ...formatProposal(data), description: data.description },
          {
            cta: {
              description: 'Cast your vote:',
              commands: [
                { command: 'proposals vote', args: { id: c.args.id, vote: 'for' } },
                { command: 'proposals vote', args: { id: c.args.id, vote: 'against' } },
              ],
            },
          },
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch proposal ${c.args.id}: ${message}`,
          retryable: true,
        });
      });
  },
});

proposals.command('vote', {
  description: 'Vote on a governance proposal.',
  args: z.object({
    id: z.string().describe('Proposal ID'),
    vote: z.enum(['for', 'against', 'abstain']).describe('Your vote'),
  }),
  options: z.object({
    reason: z.string().optional().describe('Optional reason for your vote'),
  }),
  env: assemblyEnv,
  examples: [
    { args: { id: '42', vote: 'for' }, description: 'Vote in favor of proposal #42' },
    {
      args: { id: '42', vote: 'against' },
      options: { reason: 'Insufficient detail' },
      description: 'Vote against with a reason',
    },
  ],
  run(c) {
    const client = getClient(c.env);
    return client.proposals
      .vote(c.args.id, c.args.vote, c.options.reason)
      .then((data) =>
        c.ok(
          {
            success: data.success,
            proposalId: c.args.id,
            vote: c.args.vote,
            reason: c.options.reason,
          },
          {
            cta: {
              description: 'View vote tally:',
              commands: [{ command: 'votes tally', args: { proposalId: c.args.id } }],
            },
          },
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'VOTE_ERROR',
          message: `Failed to submit vote: ${message}`,
          retryable: false,
        });
      });
  },
});
