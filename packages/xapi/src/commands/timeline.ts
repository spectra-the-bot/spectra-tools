import { Cli, z } from 'incur';
import { createXApiClient, relativeTime, truncateText } from '../api.js';
import { readAuthToken, xApiReadEnv } from '../auth.js';
import { collectPaged } from '../collect-paged.js';

const timeline = Cli.create('timeline', {
  description: 'View your X timeline.',
});

timeline.command('home', {
  description: 'View your home timeline.',
  options: z.object({
    maxResults: z.number().default(25).describe('Maximum posts to return (5–100)'),
    sinceId: z.string().optional().describe('Only return posts newer than this post ID'),
    verbose: z.boolean().optional().describe('Show full text without truncation'),
  }),
  alias: { maxResults: 'n' },
  env: xApiReadEnv,
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
    {
      options: { sinceId: '1900123456789012345' },
      description: 'Resume from last-seen post ID',
    },
  ],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const meRes = await client.getMe();
    const userId = meRes.data.id;
    const allPosts = await collectPaged(
      (limit, cursor) => client.getHomeTimeline(userId, limit, cursor, c.options.sinceId),
      (
        post,
      ): {
        id: string;
        text: string;
        author_id: string | undefined;
        created_at: string | undefined;
        likes: number | undefined;
        retweets: number | undefined;
      } => ({
        id: post.id,
        text: c.options.verbose ? post.text : truncateText(post.text),
        author_id: post.author_id,
        created_at: post.created_at ? relativeTime(post.created_at) : undefined,
        likes: post.public_metrics?.like_count,
        retweets: post.public_metrics?.retweet_count,
      }),
      c.options.maxResults,
    );

    const firstId = allPosts[0]?.id;
    return c.ok(
      { posts: allPosts, count: allPosts.length },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: firstId
              ? {
                  description: 'Next steps:',
                  commands: [
                    {
                      command: 'posts get',
                      args: { id: firstId },
                      description: 'View top post in detail',
                    },
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
    sinceId: z.string().optional().describe('Only return mentions newer than this post ID'),
    verbose: z.boolean().optional().describe('Show full text without truncation'),
  }),
  alias: { maxResults: 'n' },
  env: xApiReadEnv,
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
    {
      options: { sinceId: '1900123456789012345' },
      description: 'Resume mentions from last-seen post ID',
    },
  ],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const meRes = await client.getMe();
    const userId = meRes.data.id;
    const allPosts = await collectPaged(
      (limit, cursor) => client.getMentionsTimeline(userId, limit, cursor, c.options.sinceId),
      (
        post,
      ): {
        id: string;
        text: string;
        author_id: string | undefined;
        created_at: string | undefined;
      } => ({
        id: post.id,
        text: c.options.verbose ? post.text : truncateText(post.text),
        author_id: post.author_id,
        created_at: post.created_at ? relativeTime(post.created_at) : undefined,
      }),
      c.options.maxResults,
    );

    return c.ok({ posts: allPosts, count: allPosts.length });
  },
});

export { timeline };
