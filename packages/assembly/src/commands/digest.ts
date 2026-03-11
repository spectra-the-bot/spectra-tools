import { withCommandSpan } from '@spectratools/cli-shared/telemetry';
import { z } from 'incur';
import type { Address } from 'viem';
import { createAssemblyPublicClient } from '../contracts/client.js';
import {
  type DecodedComment,
  type DecodedPetition,
  type DecodedThread,
  fetchAllComments,
  fetchAllPetitions,
  fetchAllThreads,
  fetchHasSignedBatch,
} from '../services/forum.js';
import {
  type DecodedProposal,
  fetchAllProposals,
  fetchHasVotedBatch,
  proposalStatusLabels,
  serializeProposal,
} from '../services/governance.js';
import {
  AssemblyApiValidationError,
  type MemberIdentity,
  fetchMemberList,
  fetchMemberOnchainState,
} from '../services/members.js';
import { isoTime, toChecksum } from './_common.js';

const digestEnv = z.object({
  ABSTRACT_RPC_URL: z.string().optional().describe('Abstract RPC URL override'),
  ASSEMBLY_INDEXER_URL: z
    .string()
    .optional()
    .describe('Optional members snapshot endpoint (default: theaiassembly.org indexer)'),
});

const memberItemSchema = z.object({
  address: z.string(),
  active: z.boolean(),
  registered: z.boolean(),
  activeUntil: z.string(),
  lastHeartbeatAt: z.string(),
});

const proposalDigestSchema = z.object({
  id: z.number(),
  kind: z.number(),
  configRiskTier: z.number(),
  origin: z.number(),
  status: z.string(),
  statusCode: z.number(),
  proposer: z.string(),
  threadId: z.number(),
  petitionId: z.number(),
  createdAt: z.number(),
  deliberationEndsAt: z.number(),
  voteStartAt: z.number(),
  voteEndAt: z.number(),
  timelockEndsAt: z.number(),
  activeSeatsSnapshot: z.number(),
  forVotes: z.string(),
  againstVotes: z.string(),
  abstainVotes: z.string(),
  amount: z.string(),
  snapshotAssetBalance: z.string(),
  transferIntent: z.boolean(),
  intentDeadline: z.number(),
  intentMaxRiskTier: z.number(),
  title: z.string(),
  description: z.string(),
  hasVoted: z.boolean().optional(),
});

const threadDigestSchema = z.object({
  id: z.number(),
  kind: z.number(),
  author: z.string(),
  createdAt: z.number(),
  category: z.string(),
  title: z.string(),
  proposalId: z.number(),
  petitionId: z.number(),
});

const commentDigestSchema = z.object({
  id: z.number(),
  threadId: z.number(),
  parentId: z.number(),
  author: z.string(),
  createdAt: z.number(),
  body: z.string(),
});

const petitionDigestSchema = z.object({
  id: z.number(),
  proposer: z.string(),
  createdAt: z.number(),
  category: z.string(),
  title: z.string(),
  body: z.string(),
  signatures: z.number(),
  promoted: z.boolean(),
  threadId: z.number(),
  hasSigned: z.boolean().optional(),
});

const proposalSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.string(),
  statusCode: z.number(),
  createdAt: z.number(),
  hasVoted: z.boolean().optional(),
});

const threadSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  createdAt: z.number(),
});

const commentSummarySchema = z.object({
  id: z.number(),
  threadId: z.number(),
  author: z.string(),
  createdAt: z.number(),
});

const petitionSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  signatures: z.number(),
  promoted: z.boolean(),
  createdAt: z.number(),
  hasSigned: z.boolean().optional(),
});

const filtersMetaSchema = z.object({
  since: z.string().optional(),
  until: z.string().optional(),
  omitComments: z.boolean().optional(),
  omitMembers: z.boolean().optional(),
  omitPetitions: z.boolean().optional(),
  proposalsLimit: z.number().optional(),
  threadsLimit: z.number().optional(),
  commentsLimit: z.number().optional(),
  petitionsLimit: z.number().optional(),
  summaryOnly: z.boolean().optional(),
  proposalStatus: z.string().optional(),
});

const digestOutputSchema = z.object({
  meta: z.object({
    chainId: z.number(),
    fetchedAt: z.string(),
    address: z.string().optional(),
    filters: filtersMetaSchema.optional(),
  }),
  proposals: z.array(z.union([proposalDigestSchema, proposalSummarySchema])),
  threads: z.array(z.union([threadDigestSchema, threadSummarySchema])),
  comments: z.array(z.union([commentDigestSchema, commentSummarySchema])).optional(),
  petitions: z.array(z.union([petitionDigestSchema, petitionSummarySchema])).optional(),
  members: z
    .object({
      count: z.number(),
      items: z.array(memberItemSchema),
    })
    .optional(),
  errors: z.array(z.string()),
});

/** Parse a duration shorthand like "24h", "7d", "30m" to milliseconds. */
export function parseDuration(value: string): number | null {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(m|h|d)$/i);
  if (!match) return null;
  const amount = Number.parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 3600 * 1000;
    case 'd':
      return amount * 86400 * 1000;
    default:
      return null;
  }
}

const validProposalStatuses = new Set(Object.values(proposalStatusLabels));

// biome-ignore lint/suspicious/noExplicitAny: incur Cli type is opaque; using any for registration function parameter
export function registerDigestCommand(cli: any) {
  cli.command('digest', {
    description:
      'Aggregate proposals, threads, comments, petitions, and members into a single governance snapshot.',
    options: z.object({
      address: z
        .string()
        .optional()
        .describe('Wallet address to enrich proposals (hasVoted) and petitions (hasSigned)'),
      since: z
        .string()
        .optional()
        .describe('Only items created/updated after this ISO-8601 timestamp'),
      last: z
        .string()
        .optional()
        .describe('Duration shorthand (e.g. 24h, 7d, 30m) — converted to --since'),
      until: z
        .string()
        .optional()
        .describe('Only items created/updated before this ISO-8601 timestamp'),
      'omit-comments': z.boolean().optional().describe('Exclude comments from output'),
      'omit-members': z.boolean().optional().describe('Exclude members from output'),
      'omit-petitions': z.boolean().optional().describe('Exclude petitions from output'),
      'proposals-limit': z.number().optional().describe('Return only the most recent N proposals'),
      'threads-limit': z.number().optional().describe('Return only the most recent N threads'),
      'comments-limit': z.number().optional().describe('Return only the most recent N comments'),
      'petitions-limit': z.number().optional().describe('Return only the most recent N petitions'),
      'summary-only': z
        .boolean()
        .optional()
        .describe('Return only counts/metadata per section (no full bodies)'),
      'proposal-status': z
        .string()
        .optional()
        .describe('Filter proposals by status (pending/active/passed/executed/defeated/cancelled)'),
    }),
    env: digestEnv,
    output: digestOutputSchema,
    examples: [
      { description: 'Fetch a full governance digest' },
      {
        options: { address: '0x230Ccc765765d729fFb1897D538f773b92005Aa2' },
        description: 'Fetch digest with wallet-relative enrichment',
      },
      {
        options: { last: '24h' },
        description: 'Fetch digest for the last 24 hours',
      },
      {
        options: { 'summary-only': true },
        description: 'Fetch digest with only summary metadata',
      },
      {
        options: { 'proposal-status': 'active', 'omit-comments': true },
        description: 'Fetch only active proposals, omitting comments',
      },
    ],
    async run(c: {
      options: {
        address?: string;
        since?: string;
        last?: string;
        until?: string;
        'omit-comments'?: boolean;
        'omit-members'?: boolean;
        'omit-petitions'?: boolean;
        'proposals-limit'?: number;
        'threads-limit'?: number;
        'comments-limit'?: number;
        'petitions-limit'?: number;
        'summary-only'?: boolean;
        'proposal-status'?: string;
      };
      env: z.infer<typeof digestEnv>;
      format: string;
      ok: (data: z.infer<typeof digestOutputSchema>) => unknown;
      error: (err: { code: string; message: string; retryable: boolean }) => unknown;
    }) {
      return withCommandSpan('assembly digest', { address: c.options.address }, async () => {
        const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
        const errors: string[] = [];
        const address = c.options.address ? (toChecksum(c.options.address) as Address) : undefined;

        // --- Resolve time-window filters ---
        let sinceTs: number | undefined;
        let untilTs: number | undefined;

        if (c.options.last && c.options.since) {
          return c.error({
            code: 'INVALID_OPTIONS',
            message: 'Cannot specify both --since and --last',
            retryable: false,
          });
        }

        if (c.options.last) {
          const durationMs = parseDuration(c.options.last);
          if (durationMs === null) {
            return c.error({
              code: 'INVALID_DURATION',
              message: `Invalid duration format: "${c.options.last}". Use e.g. 24h, 7d, 30m`,
              retryable: false,
            });
          }
          sinceTs = Math.floor((Date.now() - durationMs) / 1000);
        } else if (c.options.since) {
          const parsed = Date.parse(c.options.since);
          if (Number.isNaN(parsed)) {
            return c.error({
              code: 'INVALID_TIMESTAMP',
              message: `Invalid --since timestamp: "${c.options.since}"`,
              retryable: false,
            });
          }
          sinceTs = Math.floor(parsed / 1000);
        }

        if (c.options.until) {
          const parsed = Date.parse(c.options.until);
          if (Number.isNaN(parsed)) {
            return c.error({
              code: 'INVALID_TIMESTAMP',
              message: `Invalid --until timestamp: "${c.options.until}"`,
              retryable: false,
            });
          }
          untilTs = Math.floor(parsed / 1000);
        }

        // --- Validate proposal-status filter ---
        const proposalStatusFilter = c.options['proposal-status'];
        if (proposalStatusFilter && !validProposalStatuses.has(proposalStatusFilter)) {
          return c.error({
            code: 'INVALID_STATUS',
            message: `Invalid --proposal-status: "${proposalStatusFilter}". Valid: ${[...validProposalStatuses].join(', ')}`,
            retryable: false,
          });
        }

        // --- Section flags ---
        const omitComments = c.options['omit-comments'] ?? false;
        const omitMembers = c.options['omit-members'] ?? false;
        const omitPetitions = c.options['omit-petitions'] ?? false;
        const summaryOnly = c.options['summary-only'] ?? false;
        const proposalsLimit = c.options['proposals-limit'];
        const threadsLimit = c.options['threads-limit'];
        const commentsLimit = c.options['comments-limit'];
        const petitionsLimit = c.options['petitions-limit'];

        // Fetch all data sources concurrently (skip omitted sections)
        const [proposalsResult, threadsResult, commentsResult, petitionsResult, membersResult] =
          await Promise.allSettled([
            fetchAllProposals(client),
            fetchAllThreads(client),
            omitComments ? Promise.resolve([]) : fetchAllComments(client),
            omitPetitions ? Promise.resolve([]) : fetchAllPetitions(client),
            omitMembers
              ? Promise.resolve({ members: [] as MemberIdentity[], fallbackReason: undefined })
              : fetchMemberList(client, c.env.ASSEMBLY_INDEXER_URL),
          ]);

        // Extract proposals
        let proposals: DecodedProposal[] = [];
        if (proposalsResult.status === 'fulfilled') {
          proposals = proposalsResult.value;
        } else {
          errors.push(`proposals: ${proposalsResult.reason}`);
        }

        // Extract threads
        let threads: DecodedThread[] = [];
        if (threadsResult.status === 'fulfilled') {
          threads = threadsResult.value;
        } else {
          errors.push(`threads: ${threadsResult.reason}`);
        }

        // Extract comments
        let comments: DecodedComment[] = [];
        if (!omitComments) {
          if (commentsResult.status === 'fulfilled') {
            comments = commentsResult.value as DecodedComment[];
          } else {
            errors.push(`comments: ${commentsResult.reason}`);
          }
        }

        // Extract petitions
        let petitions: DecodedPetition[] = [];
        if (!omitPetitions) {
          if (petitionsResult.status === 'fulfilled') {
            petitions = petitionsResult.value as DecodedPetition[];
          } else {
            errors.push(`petitions: ${petitionsResult.reason}`);
          }
        }

        // Extract members
        let memberIdentities: MemberIdentity[] = [];
        if (!omitMembers) {
          if (membersResult.status === 'fulfilled') {
            const loaded = membersResult.value as {
              members: MemberIdentity[];
              fallbackReason?: { code: string; url: string };
            };
            memberIdentities = loaded.members;
            if (loaded.fallbackReason) {
              process.stderr.write(
                `${JSON.stringify({
                  level: 'warn',
                  code: loaded.fallbackReason.code,
                  message:
                    'Member snapshot indexer is unavailable. Falling back to on-chain Registered events.',
                  url: loaded.fallbackReason.url,
                })}\n`,
              );
            }
          } else {
            const err = membersResult.reason;
            if (err instanceof AssemblyApiValidationError) {
              errors.push(`members: ${err.details.code}`);
            } else {
              errors.push(`members: ${err}`);
            }
          }
        }

        // --- Apply time-window filters ---
        if (sinceTs !== undefined) {
          proposals = proposals.filter((p) => Number(p.createdAt) >= sinceTs);
          threads = threads.filter((t) => t.createdAt >= sinceTs);
          comments = comments.filter((cm) => cm.createdAt >= sinceTs);
          petitions = petitions.filter((p) => p.createdAt >= sinceTs);
        }
        if (untilTs !== undefined) {
          proposals = proposals.filter((p) => Number(p.createdAt) <= untilTs);
          threads = threads.filter((t) => t.createdAt <= untilTs);
          comments = comments.filter((cm) => cm.createdAt <= untilTs);
          petitions = petitions.filter((p) => p.createdAt <= untilTs);
        }

        // --- Apply proposal status filter ---
        if (proposalStatusFilter) {
          const statusLabelToCode = new Map<string, number>();
          for (const [code, label] of Object.entries(proposalStatusLabels)) {
            statusLabelToCode.set(label, Number(code));
          }
          const targetCode = statusLabelToCode.get(proposalStatusFilter);
          if (targetCode !== undefined) {
            proposals = proposals.filter((p) => Number(p.status) === targetCode);
          }
        }

        // --- Sort by createdAt descending (most recent first) for limit application ---
        proposals.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
        threads.sort((a, b) => b.createdAt - a.createdAt);
        comments.sort((a, b) => b.createdAt - a.createdAt);
        petitions.sort((a, b) => b.createdAt - a.createdAt);

        // --- Apply section limits ---
        if (proposalsLimit !== undefined) {
          proposals = proposals.slice(0, proposalsLimit);
        }
        if (threadsLimit !== undefined) {
          threads = threads.slice(0, threadsLimit);
        }
        if (commentsLimit !== undefined) {
          comments = comments.slice(0, commentsLimit);
        }
        if (petitionsLimit !== undefined) {
          petitions = petitions.slice(0, petitionsLimit);
        }

        // Fetch onchain state for members
        let memberItems: z.infer<typeof memberItemSchema>[] = [];
        if (!omitMembers && memberIdentities.length > 0) {
          try {
            const onchainStates = await fetchMemberOnchainState(
              client,
              memberIdentities.map((m) => m.address),
            );
            memberItems = onchainStates.map((s) => ({
              address: s.address,
              active: s.active,
              registered: s.registered,
              activeUntil: isoTime(s.activeUntil),
              lastHeartbeatAt: isoTime(s.lastHeartbeatAt),
            }));
          } catch (err) {
            errors.push(`members onchain state: ${err}`);
          }
        }

        // Wallet-relative enrichment
        let hasVotedMap = new Map<number, boolean>();
        let hasSignedMap = new Map<number, boolean>();

        if (address) {
          const proposalIds = proposals.map((_, i) => i + 1);
          const petitionIds = petitions.map((p) => p.id);

          const [votedResult, signedResult] = await Promise.allSettled([
            fetchHasVotedBatch(client, address, proposalIds),
            omitPetitions
              ? Promise.resolve(new Map<number, boolean>())
              : fetchHasSignedBatch(client, address, petitionIds),
          ]);

          if (votedResult.status === 'fulfilled') {
            hasVotedMap = votedResult.value;
          } else {
            errors.push(`hasVoted enrichment: ${votedResult.reason}`);
          }

          if (signedResult.status === 'fulfilled') {
            hasSignedMap = signedResult.value;
          } else {
            errors.push(`hasSigned enrichment: ${signedResult.reason}`);
          }
        }

        // --- Serialize output ---
        let serializedProposals: z.infer<typeof digestOutputSchema>['proposals'];
        if (summaryOnly) {
          serializedProposals = proposals.map((p, i) => {
            const { status, statusCode } = serializeProposal(p);
            const entry: z.infer<typeof proposalSummarySchema> & { hasVoted?: boolean } = {
              id: i + 1,
              title: p.title,
              status,
              statusCode,
              createdAt: Number(p.createdAt),
            };
            if (address) {
              entry.hasVoted = hasVotedMap.get(i + 1) ?? false;
            }
            return entry;
          });
        } else {
          serializedProposals = proposals.map((p, i) => {
            const serialized = serializeProposal(p);
            const entry: z.infer<typeof proposalDigestSchema> = {
              id: i + 1,
              ...serialized,
            };
            if (address) {
              entry.hasVoted = hasVotedMap.get(i + 1) ?? false;
            }
            return entry;
          });
        }

        let serializedThreads: z.infer<typeof digestOutputSchema>['threads'];
        if (summaryOnly) {
          serializedThreads = threads.map((t) => ({
            id: t.id,
            title: t.title,
            category: t.category,
            createdAt: t.createdAt,
          }));
        } else {
          serializedThreads = threads.map((t) => ({
            id: t.id,
            kind: t.kind,
            author: t.author,
            createdAt: t.createdAt,
            category: t.category,
            title: t.title,
            proposalId: t.proposalId,
            petitionId: t.petitionId,
          }));
        }

        let serializedComments: z.infer<typeof digestOutputSchema>['comments'] | undefined;
        if (!omitComments) {
          if (summaryOnly) {
            serializedComments = comments.map((cm) => ({
              id: cm.id,
              threadId: cm.threadId,
              author: cm.author,
              createdAt: cm.createdAt,
            }));
          } else {
            serializedComments = comments.map((cm) => ({
              id: cm.id,
              threadId: cm.threadId,
              parentId: cm.parentId,
              author: cm.author,
              createdAt: cm.createdAt,
              body: cm.body,
            }));
          }
        }

        let serializedPetitions: z.infer<typeof digestOutputSchema>['petitions'] | undefined;
        if (!omitPetitions) {
          if (summaryOnly) {
            serializedPetitions = petitions.map((p) => {
              const entry: z.infer<typeof petitionSummarySchema> & { hasSigned?: boolean } = {
                id: p.id,
                title: p.title,
                category: p.category,
                signatures: p.signatures,
                promoted: p.promoted,
                createdAt: p.createdAt,
              };
              if (address) {
                entry.hasSigned = hasSignedMap.get(p.id) ?? false;
              }
              return entry;
            });
          } else {
            serializedPetitions = petitions.map((p) => {
              const entry: z.infer<typeof petitionDigestSchema> = {
                id: p.id,
                proposer: p.proposer,
                createdAt: p.createdAt,
                category: p.category,
                title: p.title,
                body: p.body,
                signatures: p.signatures,
                promoted: p.promoted,
                threadId: p.threadId,
              };
              if (address) {
                entry.hasSigned = hasSignedMap.get(p.id) ?? false;
              }
              return entry;
            });
          }
        }

        // --- Build filters meta ---
        const filtersMeta: z.infer<typeof filtersMetaSchema> = {};
        if (sinceTs !== undefined) filtersMeta.since = isoTime(sinceTs);
        if (untilTs !== undefined) filtersMeta.until = isoTime(untilTs);
        if (omitComments) filtersMeta.omitComments = true;
        if (omitMembers) filtersMeta.omitMembers = true;
        if (omitPetitions) filtersMeta.omitPetitions = true;
        if (proposalsLimit !== undefined) filtersMeta.proposalsLimit = proposalsLimit;
        if (threadsLimit !== undefined) filtersMeta.threadsLimit = threadsLimit;
        if (commentsLimit !== undefined) filtersMeta.commentsLimit = commentsLimit;
        if (petitionsLimit !== undefined) filtersMeta.petitionsLimit = petitionsLimit;
        if (summaryOnly) filtersMeta.summaryOnly = true;
        if (proposalStatusFilter) filtersMeta.proposalStatus = proposalStatusFilter;
        const hasFilters = Object.keys(filtersMeta).length > 0;

        const output: z.infer<typeof digestOutputSchema> = {
          meta: {
            chainId: 2741,
            fetchedAt: new Date().toISOString().replace('.000Z', 'Z'),
            ...(address ? { address } : {}),
            ...(hasFilters ? { filters: filtersMeta } : {}),
          },
          proposals: serializedProposals,
          threads: serializedThreads,
          ...(omitComments ? {} : { comments: serializedComments }),
          ...(omitPetitions ? {} : { petitions: serializedPetitions }),
          ...(omitMembers ? {} : { members: { count: memberItems.length, items: memberItems } }),
          errors,
        };

        return c.ok(output);
      });
    },
  });
}
