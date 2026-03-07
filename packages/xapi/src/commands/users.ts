import { Cli, z } from 'incur';
import { apiKeyAuth, paginateCursor } from '@spectra-the-bot/cli-shared';
import { createXApiClient, relativeTime, truncateText } from '../api.js';

const users = Cli.create('users', {
  description: 'Look up X users.',
});

async function resolveUser(client: ReturnType<typeof createXApiClient>, usernameOrId: string) {
  // If it looks like a numeric ID, fetch by ID; otherwise by username.
  if (/^\d+$/.test(usernameOrId)) {
    return client.getUserById(usernameOrId);
  }
  return client.getUserByUsername(usernameOrId.replace(/^@/, ''));
}

users.command('get', {
  description: 'Get a user by username or ID.',
  args: z.object({
    username: z.string().describe('Username (with or without @) or user ID'),
  }),
  options: z.object({
    verbose: z.boolean().optional().describe('Show full bio without truncation'),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    description: z.string().optional(),
    followers: z.number().optional(),
    following: z.number().optional(),
    tweets: z.number().optional(),
    joined: z.string().optional(),
  }),
  examples: [
    { args: { username: 'jack' }, description: 'Get a user by username' },
    { args: { username: '12345' }, description: 'Get a user by ID' },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const res = await resolveUser(client, c.args.username);
    const user = res.data;
    return c.ok(
      {
        id: user.id,
        name: user.name,
        username: user.username,
        description: user.description
          ? c.options.verbose
            ? user.description
            : truncateText(user.description)
          : undefined,
        followers: user.public_metrics?.followers_count,
        following: user.public_metrics?.following_count,
        tweets: user.public_metrics?.tweet_count,
        joined: user.created_at ? relativeTime(user.created_at) : undefined,
      },
      {
        cta: {
          description: 'Explore this user:',
          commands: [
            { command: 'users posts', args: { username: user.username }, description: 'View their posts' },
            { command: 'users followers', args: { username: user.username }, description: 'View their followers' },
          ],
        },
      },
    );
  },
});

users.command('followers', {
  description: 'List followers of a user.',
  args: z.object({
    username: z.string().describe('Username or user ID'),
  }),
  options: z.object({
    maxResults: z.number().default(100).describe('Maximum followers to return'),
  }),
  alias: { maxResults: 'n' },
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
  examples: [
    { args: { username: 'jack' }, description: 'List followers of jack' },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const userRes = await resolveUser(client, c.args.username);
    const userId = userRes.data.id;
    const allUsers: Array<{ id: string; name: string; username: string; followers: number | undefined }> = [];

    for await (const user of paginateCursor({
      fetchPage: async (cursor: string | null) => {
        const res = await client.getUserFollowers(userId, Math.min(c.options.maxResults, 1000), cursor ?? undefined);
        return { items: res.data ?? [], nextCursor: res.meta?.next_token ?? null };
      },
    })) {
      allUsers.push({
        id: user.id,
        name: user.name,
        username: user.username,
        followers: user.public_metrics?.followers_count,
      });
      if (allUsers.length >= c.options.maxResults) break;
    }

    return c.ok({ users: allUsers, count: allUsers.length });
  },
});

users.command('following', {
  description: 'List accounts a user is following.',
  args: z.object({
    username: z.string().describe('Username or user ID'),
  }),
  options: z.object({
    maxResults: z.number().default(100).describe('Maximum accounts to return'),
  }),
  alias: { maxResults: 'n' },
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
  examples: [
    { args: { username: 'jack' }, description: 'List accounts jack follows' },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const userRes = await resolveUser(client, c.args.username);
    const userId = userRes.data.id;
    const allUsers: Array<{ id: string; name: string; username: string; followers: number | undefined }> = [];

    for await (const user of paginateCursor({
      fetchPage: async (cursor: string | null) => {
        const res = await client.getUserFollowing(userId, Math.min(c.options.maxResults, 1000), cursor ?? undefined);
        return { items: res.data ?? [], nextCursor: res.meta?.next_token ?? null };
      },
    })) {
      allUsers.push({
        id: user.id,
        name: user.name,
        username: user.username,
        followers: user.public_metrics?.followers_count,
      });
      if (allUsers.length >= c.options.maxResults) break;
    }

    return c.ok({ users: allUsers, count: allUsers.length });
  },
});

users.command('posts', {
  description: "List a user's posts.",
  args: z.object({
    username: z.string().describe('Username or user ID'),
  }),
  options: z.object({
    maxResults: z.number().default(10).describe('Maximum posts to return'),
    verbose: z.boolean().optional().describe('Show full text without truncation'),
  }),
  alias: { maxResults: 'n' },
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
    { args: { username: 'jack' }, description: "Get jack's recent posts" },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const userRes = await resolveUser(client, c.args.username);
    const userId = userRes.data.id;
    const allPosts: Array<{ id: string; text: string; created_at: string | undefined; likes: number | undefined; retweets: number | undefined }> = [];

    for await (const post of paginateCursor({
      fetchPage: async (cursor: string | null) => {
        const res = await client.getUserPosts(userId, Math.min(c.options.maxResults, 100), cursor ?? undefined);
        return { items: res.data ?? [], nextCursor: res.meta?.next_token ?? null };
      },
    })) {
      allPosts.push({
        id: post.id,
        text: c.options.verbose ? post.text : truncateText(post.text),
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

users.command('mentions', {
  description: "List recent mentions of a user.",
  args: z.object({
    username: z.string().describe('Username or user ID'),
  }),
  options: z.object({
    maxResults: z.number().default(10).describe('Maximum mentions to return'),
    verbose: z.boolean().optional().describe('Show full text'),
  }),
  alias: { maxResults: 'n' },
  output: z.object({
    posts: z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        created_at: z.string().optional(),
      }),
    ),
    count: z.number(),
  }),
  examples: [
    { args: { username: 'jack' }, description: "Get mentions of jack" },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const userRes = await resolveUser(client, c.args.username);
    const userId = userRes.data.id;
    const allPosts: Array<{ id: string; text: string; created_at: string | undefined }> = [];

    for await (const post of paginateCursor({
      fetchPage: async (cursor: string | null) => {
        const res = await client.getUserMentions(userId, Math.min(c.options.maxResults, 100), cursor ?? undefined);
        return { items: res.data ?? [], nextCursor: res.meta?.next_token ?? null };
      },
    })) {
      allPosts.push({
        id: post.id,
        text: c.options.verbose ? post.text : truncateText(post.text),
        created_at: post.created_at ? relativeTime(post.created_at) : undefined,
      });
      if (allPosts.length >= c.options.maxResults) break;
    }

    return c.ok({ posts: allPosts, count: allPosts.length });
  },
});

users.command('search', {
  description: 'Search for users by keyword.',
  args: z.object({
    query: z.string().describe('Search query'),
  }),
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
  examples: [
    { args: { query: 'TypeScript' }, description: 'Search for users about TypeScript' },
  ],
  async run(c) {
    const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
    const client = createXApiClient(apiKey);
    const res = await client.searchUsers(c.args.query);
    const items = (res.data ?? []).map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      followers: u.public_metrics?.followers_count,
    }));
    const first = items[0];
    return c.ok(
      { users: items, count: items.length },
      {
        cta: first
          ? {
              description: 'Next steps:',
              commands: [
                { command: 'users get', args: { username: first.username }, description: `View @${first.username}'s profile` },
              ],
            }
          : undefined,
      },
    );
  },
});

export { users };
