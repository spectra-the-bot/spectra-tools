import { Cli, z } from 'incur';
import { apiKeyAuth, paginateCursor } from '@spectra-the-bot/cli-shared';
import { createXApiClient, relativeTime, truncateText } from '../api.js';

const timeline = Cli.create('timeline', {
  description: 'View your X timeline.',
});

timeline.command('home', {
  description: 'View your home timeline.',
  options: z.object({
    maxResults: z.number().default(25).describe('Maximum posts to return (5–100)'),
    verbose: z.boolean().optional().describe('Show full text without truncation'),
  }),
  alias: { maxResults: 'n' },
  output: z.object({
    posts: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        author_id: z.string().optional(),
        created_at: z.string().optional(),
        likes: z.number().optional(),
        retweets: z.number().optional(),
      }),
    ),
    count: z.number(),
  }),
  examples: [
    { description: 'View your home timeline' },
    { options: { maxResults: 50 }, description: 'View 50 posts' },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const meRes = await client.getMe();
    const userId = meRes.data.id;
    const allPosts: Array<{
      id: string;
      text: string;
      author_id: string | undefined;
      created_at: string | undefined;
      likes: number | undefined;
      retweets: number | undefined;
    }> = [];

    for await (const post of paginateCursor({
      fetchPage: async (cursor: string | null) => {
        const res = await client.getHomeTimeline(userId, Math.min(c.options.maxResults, 100), cursor ?? undefined);
        return { items: res.data ?? [], nextCursor: res.meta?.next_token ?? null };
      },
    })) {
      allPosts.push({
        id: post.id,
        text: c.options.verbose ? post.text : truncateText(post.text),
        author_id: post.author_id,
        created_at: post.created_at ? relativeTime(post.created_at) : undefined,
        likes: post.public_metrics?.like_count,
        retweets: post.public_metrics?.retweet_count,
      });
      if (allPosts.length >= c.options.maxResults) break;
    }

    const firstId = allPosts[0]?.id;
    return c.ok(
      { posts: allPosts, count: allPosts.length },
      {
        cta: firstId
          ? {
              description: 'Next steps:',
              commands: [
                { command: 'posts get', args: { id: firstId }, description: 'View top post in detail' },
              ],
            }
          : undefined,
      },
    );
  },
});

timeline.command('mentions', {
  description: 'View your recent mentions.',
  options: z.object({
    maxResults: z.number().default(25).describe('Maximum mentions to return'),
    verbose: z.boolean().optional().describe('Show full text without truncation'),
  }),
  alias: { maxResults: 'n' },
  output: z.object({
    posts: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        author_id: z.string().optional(),
        created_at: z.string().optional(),
      }),
    ),
    count: z.number(),
  }),
  examples: [
    { description: 'View your recent mentions' },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const meRes = await client.getMe();
    const userId = meRes.data.id;
    const allPosts: Array<{ id: string; text: string; author_id: string | undefined; created_at: string | undefined }> = [];

    for await (const post of paginateCursor({
      fetchPage: async (cursor: string | null) => {
        const res = await client.getMentionsTimeline(userId, Math.min(c.options.maxResults, 100), cursor ?? undefined);
        return { items: res.data ?? [], nextCursor: res.meta?.next_token ?? null };
      },
    })) {
      allPosts.push({
        id: post.id,
        text: c.options.verbose ? post.text : truncateText(post.text),
        author_id: post.author_id,
        created_at: post.created_at ? relativeTime(post.created_at) : undefined,
      });
      if (allPosts.length >= c.options.maxResults) break;
    }

    return c.ok({ posts: allPosts, count: allPosts.length });
  },
});

export { timeline };
