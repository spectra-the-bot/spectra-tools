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

const digestOutputSchema = z.object({
  meta: z.object({
    chainId: z.number(),
    fetchedAt: z.string(),
    address: z.string().optional(),
  }),
  proposals: z.array(proposalDigestSchema),
  threads: z.array(threadDigestSchema),
  comments: z.array(commentDigestSchema),
  petitions: z.array(petitionDigestSchema),
  members: z.object({
    count: z.number(),
    items: z.array(memberItemSchema),
  }),
  errors: z.array(z.string()),
});

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
    }),
    env: digestEnv,
    output: digestOutputSchema,
    examples: [
      { description: 'Fetch a full governance digest' },
      {
        options: { address: '0x230Ccc765765d729fFb1897D538f773b92005Aa2' },
        description: 'Fetch digest with wallet-relative enrichment',
      },
    ],
    async run(c: {
      options: { address?: string };
      env: z.infer<typeof digestEnv>;
      format: string;
      ok: (data: z.infer<typeof digestOutputSchema>) => unknown;
      error: (err: { code: string; message: string; retryable: boolean }) => unknown;
    }) {
      return withCommandSpan('assembly digest', { address: c.options.address }, async () => {
        const client = createAssemblyPublicClient(c.env.ABSTRACT_RPC_URL);
        const errors: string[] = [];
        const address = c.options.address ? (toChecksum(c.options.address) as Address) : undefined;

        // Fetch all data sources concurrently
        const [proposalsResult, threadsResult, commentsResult, petitionsResult, membersResult] =
          await Promise.allSettled([
            fetchAllProposals(client),
            fetchAllThreads(client),
            fetchAllComments(client),
            fetchAllPetitions(client),
            fetchMemberList(client, c.env.ASSEMBLY_INDEXER_URL),
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
        if (commentsResult.status === 'fulfilled') {
          comments = commentsResult.value;
        } else {
          errors.push(`comments: ${commentsResult.reason}`);
        }

        // Extract petitions
        let petitions: DecodedPetition[] = [];
        if (petitionsResult.status === 'fulfilled') {
          petitions = petitionsResult.value;
        } else {
          errors.push(`petitions: ${petitionsResult.reason}`);
        }

        // Extract members
        let memberIdentities: MemberIdentity[] = [];
        if (membersResult.status === 'fulfilled') {
          const loaded = membersResult.value;
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

        // Fetch onchain state for members
        let memberItems: z.infer<typeof memberItemSchema>[] = [];
        if (memberIdentities.length > 0) {
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
          const [votedResult, signedResult] = await Promise.allSettled([
            fetchHasVotedBatch(
              client,
              address,
              proposals.map((_, i) => i + 1),
            ),
            fetchHasSignedBatch(
              client,
              address,
              petitions.map((p) => p.id),
            ),
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

        // Serialize output
        const serializedProposals = proposals.map((p, i) => {
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

        const serializedThreads = threads.map((t) => ({
          id: t.id,
          kind: t.kind,
          author: t.author,
          createdAt: t.createdAt,
          category: t.category,
          title: t.title,
          proposalId: t.proposalId,
          petitionId: t.petitionId,
        }));

        const serializedComments = comments.map((cm) => ({
          id: cm.id,
          threadId: cm.threadId,
          parentId: cm.parentId,
          author: cm.author,
          createdAt: cm.createdAt,
          body: cm.body,
        }));

        const serializedPetitions = petitions.map((p) => {
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

        const output: z.infer<typeof digestOutputSchema> = {
          meta: {
            chainId: 2741,
            fetchedAt: new Date().toISOString().replace('.000Z', 'Z'),
            ...(address ? { address } : {}),
          },
          proposals: serializedProposals,
          threads: serializedThreads,
          comments: serializedComments,
          petitions: serializedPetitions,
          members: {
            count: memberItems.length,
            items: memberItems,
          },
          errors,
        };

        return c.ok(output);
      });
    },
  });
}
