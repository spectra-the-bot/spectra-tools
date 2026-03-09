import { Cli, z } from 'incur';
import { createXApiClient, relativeTime, truncateText } from '../api.js';
import {
  readAuthToken,
  toWriteAuthError,
  writeAuthToken,
  xApiReadEnv,
  xApiWriteEnv,
} from '../auth.js';
import { collectPaged } from '../collect-paged.js';

const posts = Cli.create('posts', {
  description: 'Manage and search X posts.',
});

posts.command('get', {
  description: 'Get a post by ID.',
  args: z.object({
    id: z.string().describe('Post ID'),
  }),
  options: z.object({
    verbose: z.boolean().optional().describe('Show full text without truncation'),
  }),
  env: xApiReadEnv,
  output: z.object({
    id: z.string(),
    text: z.string(),
    author_id: z.string().optional(),
    created_at: z.string().optional(),
    likes: z.number().optional(),
    retweets: z.number().optional(),
    replies: z.number().optional(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Get a post by ID' }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const res = await client.getPost(c.args.id);
    const post = res.data;
    const text = c.options.verbose ? post.text : truncateText(post.text);
    return c.ok(
      {
        id: post.id,
        text,
        author_id: post.author_id,
        created_at: post.created_at ? relativeTime(post.created_at) : undefined,
        likes: post.public_metrics?.like_count,
        retweets: post.public_metrics?.retweet_count,
        replies: post.public_metrics?.reply_count,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Explore this post:',
              commands: [
                {
                  command: 'posts likes',
                  args: { id: c.args.id },
                  description: 'See who liked this post',
                },
                {
                  command: 'posts retweets',
                  args: { id: c.args.id },
                  description: 'See who retweeted this post',
                },
              ],
            },
          },
    );
  },
});

posts.command('search', {
  description: 'Search recent posts.',
  args: z.object({
    query: z.string().describe('Search query'),
  }),
  options: z.object({
    maxResults: z
      .number()
      .int()
      .min(10)
      .max(100)
      .default(10)
      .describe('Maximum results to return (10–100)'),
    sort: z.enum(['recency', 'relevancy']).default('recency').describe('Sort order'),
    verbose: z.boolean().optional().describe('Show full text without truncation'),
  }),
  alias: { maxResults: 'n' },
  env: xApiReadEnv,
  output: z.object({
    posts: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        created_at: z.string().optional(),
        likes: z.number().optional(),
        retweets: z.number().optional(),
      }),
    ),
    count: z.number(),
  }),
  examples: [
    { args: { query: 'TypeScript' }, description: 'Search for TypeScript posts' },
    {
      args: { query: 'AI' },
      options: { sort: 'relevancy', maxResults: 20 },
      description: 'Search by relevance',
    },
  ],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const res = await client.searchPosts(c.args.query, c.options.maxResults, c.options.sort);
    const items = (res.data ?? []).map((p) => ({
      id: p.id,
      text: c.options.verbose ? p.text : truncateText(p.text),
      created_at: p.created_at ? relativeTime(p.created_at) : undefined,
      likes: p.public_metrics?.like_count,
      retweets: p.public_metrics?.retweet_count,
    }));
    const firstId = items[0]?.id;
    return c.ok(
      { posts: items, count: items.length },
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
                      description: 'View top result in detail',
                    },
                  ],
                }
              : undefined,
          },
    );
  },
});

posts.command('create', {
  description: 'Create a new post.',
  options: z.object({
    text: z.string().describe('Post text'),
    replyTo: z.string().optional().describe('Reply to post ID'),
    quote: z.string().optional().describe('Quote post ID'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    id: z.string(),
    text: z.string(),
  }),
  examples: [
    { options: { text: 'Hello world!' }, description: 'Post a simple message' },
    { options: { text: 'Great point!', replyTo: '1234567890' }, description: 'Reply to a post' },
  ],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const res = await client.createPost(c.options.text, c.options.replyTo, c.options.quote);
      return c.ok(
        res.data,
        c.format === 'json' || c.format === 'jsonl'
          ? undefined
          : {
              cta: {
                description: 'View your post:',
                commands: [
                  {
                    command: 'posts get',
                    args: { id: res.data.id },
                    description: 'See the created post',
                  },
                ],
              },
            },
      );
    } catch (error) {
      const authError = toWriteAuthError('posts create', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

posts.command('delete', {
  description: 'Delete a post by ID.',
  args: z.object({
    id: z.string().describe('Post ID to delete'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    deleted: z.boolean(),
    id: z.string(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Delete a post' }],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const res = await client.deletePost(c.args.id);
      return c.ok({ deleted: res.data.deleted, id: c.args.id });
    } catch (error) {
      const authError = toWriteAuthError('posts delete', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

posts.command('like', {
  description: 'Like a post by ID.',
  args: z.object({
    id: z.string().describe('Post ID to like'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    liked: z.boolean(),
    id: z.string(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Like a post' }],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const me = await client.getMe();
      const res = await client.likePost(me.data.id, c.args.id);
      return c.ok({ liked: res.data.liked, id: c.args.id });
    } catch (error) {
      const authError = toWriteAuthError('posts like', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

posts.command('unlike', {
  description: 'Unlike a post by ID.',
  args: z.object({
    id: z.string().describe('Post ID to unlike'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    liked: z.boolean(),
    id: z.string(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Unlike a post' }],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const me = await client.getMe();
      const res = await client.unlikePost(me.data.id, c.args.id);
      return c.ok({ liked: res.data.liked, id: c.args.id });
    } catch (error) {
      const authError = toWriteAuthError('posts unlike', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

posts.command('bookmark', {
  description: 'Bookmark a post by ID.',
  args: z.object({
    id: z.string().describe('Post ID to bookmark'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    bookmarked: z.boolean(),
    id: z.string(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Bookmark a post' }],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const me = await client.getMe();
      const res = await client.bookmarkPost(me.data.id, c.args.id);
      return c.ok({ bookmarked: res.data.bookmarked, id: c.args.id });
    } catch (error) {
      const authError = toWriteAuthError('posts bookmark', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

posts.command('unbookmark', {
  description: 'Remove bookmark from a post by ID.',
  args: z.object({
    id: z.string().describe('Post ID to unbookmark'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    bookmarked: z.boolean(),
    id: z.string(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Remove a bookmark from a post' }],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const me = await client.getMe();
      const res = await client.unbookmarkPost(me.data.id, c.args.id);
      return c.ok({ bookmarked: res.data.bookmarked, id: c.args.id });
    } catch (error) {
      const authError = toWriteAuthError('posts unbookmark', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

posts.command('retweet', {
  description: 'Retweet a post by ID.',
  args: z.object({
    id: z.string().describe('Post ID to retweet'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    retweeted: z.boolean(),
    id: z.string(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Retweet a post' }],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const me = await client.getMe();
      const res = await client.retweetPost(me.data.id, c.args.id);
      return c.ok({ retweeted: res.data.retweeted, id: c.args.id });
    } catch (error) {
      const authError = toWriteAuthError('posts retweet', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

posts.command('likes', {
  description: 'List users who liked a post.',
  args: z.object({
    id: z.string().describe('Post ID'),
  }),
  options: z.object({
    maxResults: z.number().default(100).describe('Maximum users to return'),
  }),
  alias: { maxResults: 'n' },
  env: xApiReadEnv,
  output: z.object({
    users: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        username: z.string(),
        followers: z.number().optional(),
      }),
    ),
    count: z.number(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'See who liked a post' }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const allUsers = await collectPaged(
      (limit, cursor) => client.getPostLikes(c.args.id, limit, cursor),
      (
        user,
      ): {
        id: string;
        name: string;
        username: string;
        followers: number | undefined;
      } => ({
        id: user.id,
        name: user.name,
        username: user.username,
        followers: user.public_metrics?.followers_count,
      }),
      c.options.maxResults,
    );

    return c.ok(
      { users: allUsers, count: allUsers.length },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Next steps:',
              commands: allUsers.slice(0, 1).map((u) => ({
                command: 'users get',
                args: { username: u.username },
                description: `View profile of @${u.username}`,
              })),
            },
          },
    );
  },
});

posts.command('retweets', {
  description: 'List users who retweeted a post.',
  args: z.object({
    id: z.string().describe('Post ID'),
  }),
  options: z.object({
    maxResults: z.number().default(100).describe('Maximum users to return'),
  }),
  alias: { maxResults: 'n' },
  env: xApiReadEnv,
  output: z.object({
    users: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        username: z.string(),
        followers: z.number().optional(),
      }),
    ),
    count: z.number(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'See who retweeted a post' }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const allUsers = await collectPaged(
      (limit, cursor) => client.getPostRetweets(c.args.id, limit, cursor),
      (
        user,
      ): {
        id: string;
        name: string;
        username: string;
        followers: number | undefined;
      } => ({
        id: user.id,
        name: user.name,
        username: user.username,
        followers: user.public_metrics?.followers_count,
      }),
      c.options.maxResults,
    );

    return c.ok({ users: allUsers, count: allUsers.length });
  },
});

export { posts };
