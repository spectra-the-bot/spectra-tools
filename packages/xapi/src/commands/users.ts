import { readFileSync } from 'node:fs';
import { Cli, z } from 'incur';
import { type XUser, createXApiClient, relativeTime, truncateText } from '../api.js';
import {
  readAuthToken,
  toWriteAuthError,
  writeAuthToken,
  xApiReadEnv,
  xApiWriteEnv,
} from '../auth.js';
import { collectPaged } from '../collect-paged.js';

const users = Cli.create('users', {
  description: 'Look up X users.',
});

async function resolveUser(client: ReturnType<typeof createXApiClient>, usernameOrId: string) {
  if (/^\d+$/.test(usernameOrId)) {
    return client.getUserById(usernameOrId);
  }
  return client.getUserByUsername(usernameOrId.replace(/^@/, ''));
}

function formatUserProfile(user: XUser, verbose?: boolean) {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    description: user.description
      ? verbose
        ? user.description
        : truncateText(user.description)
      : undefined,
    followers: user.public_metrics?.followers_count,
    following: user.public_metrics?.following_count,
    tweets: user.public_metrics?.tweet_count,
    joined: user.created_at ? relativeTime(user.created_at) : undefined,
  };
}

function readSeenIds(filePath: string): Set<string> {
  const fileContents = readFileSync(filePath, 'utf8');
  return new Set(
    fileContents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

const followersOptionsSchema = z
  .object({
    maxResults: z.number().default(100).describe('Maximum followers to return'),
    seenIdsFile: z
      .string()
      .optional()
      .describe(
        'Path to newline-delimited follower IDs used as a baseline for client-side diffing',
      ),
    newOnly: z
      .boolean()
      .default(false)
      .describe(
        'Return only followers not found in --seen-ids-file (client-side baseline diff; not API-native since_id)',
      ),
  })
  .refine((options) => !options.newOnly || Boolean(options.seenIdsFile), {
    path: ['seenIdsFile'],
    message: '--seen-ids-file is required when --new-only is set',
  });

users.command('me', {
  description: 'Get the authenticated user profile and metrics.',
  options: z.object({
    verbose: z.boolean().optional().describe('Show full bio without truncation'),
  }),
  env: xApiReadEnv,
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
  examples: [{ description: 'Get your authenticated profile', options: {} }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const res = await client.getMe();
    const user = res.data;

    return c.ok(
      formatUserProfile(user, c.options.verbose),
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Explore your account:',
              commands: [
                {
                  command: 'users followers',
                  args: { username: user.username },
                  description: 'View your followers',
                },
                {
                  command: 'users posts',
                  args: { username: user.username },
                  description: 'View your recent posts',
                },
              ],
            },
          },
    );
  },
});

users.command('get', {
  description: 'Get a user by username or ID.',
  args: z.object({
    username: z.string().describe('Username (with or without @) or user ID'),
  }),
  options: z.object({
    verbose: z.boolean().optional().describe('Show full bio without truncation'),
  }),
  env: xApiReadEnv,
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
    const client = createXApiClient(readAuthToken(c.env));
    const res = await resolveUser(client, c.args.username);
    const user = res.data;
    return c.ok(
      formatUserProfile(user, c.options.verbose),
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Explore this user:',
              commands: [
                {
                  command: 'users posts',
                  args: { username: user.username },
                  description: 'View their posts',
                },
                {
                  command: 'users followers',
                  args: { username: user.username },
                  description: 'View their followers',
                },
              ],
            },
          },
    );
  },
});

users.command('follow', {
  description: 'Follow a user by username or ID.',
  args: z.object({
    username: z.string().describe('Username (with or without @) or user ID'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    id: z.string(),
    username: z.string(),
    following: z.boolean(),
    pending_follow: z.boolean().optional(),
  }),
  examples: [{ args: { username: 'jack' }, description: 'Follow @jack' }],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const me = await client.getMe();
      const targetRes = await resolveUser(client, c.args.username);
      const target = targetRes.data;
      const res = await client.followUser(me.data.id, target.id);

      return c.ok({
        id: target.id,
        username: target.username,
        following: res.data.following,
        pending_follow: res.data.pending_follow,
      });
    } catch (error) {
      const authError = toWriteAuthError('users follow', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

users.command('unfollow', {
  description: 'Unfollow a user by username or ID.',
  args: z.object({
    username: z.string().describe('Username (with or without @) or user ID'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    id: z.string(),
    username: z.string(),
    following: z.boolean(),
  }),
  examples: [{ args: { username: 'jack' }, description: 'Unfollow @jack' }],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const me = await client.getMe();
      const targetRes = await resolveUser(client, c.args.username);
      const target = targetRes.data;
      const res = await client.unfollowUser(me.data.id, target.id);

      return c.ok({
        id: target.id,
        username: target.username,
        following: res.data.following,
      });
    } catch (error) {
      const authError = toWriteAuthError('users unfollow', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

users.command('followers', {
  description:
    'List followers of a user. Supports optional client-side baseline diffing for new follower detection.',
  args: z.object({
    username: z.string().describe('Username or user ID'),
  }),
  options: followersOptionsSchema,
  alias: { maxResults: 'n', seenIdsFile: 's' },
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
  examples: [
    { args: { username: 'jack' }, description: 'List followers of jack' },
    {
      args: { username: 'jack' },
      options: { seenIdsFile: './seen-followers.txt', newOnly: true },
      description:
        'Show only followers not in your baseline file (client-side diffing; the X API does not support since_id here)',
    },
  ],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const userRes = await resolveUser(client, c.args.username);
    const userId = userRes.data.id;
    const allUsers = await collectPaged(
      (limit, cursor) => client.getUserFollowers(userId, limit, cursor),
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
      1000,
    );

    if (!c.options.newOnly) {
      return c.ok({ users: allUsers, count: allUsers.length });
    }

    if (!c.options.seenIdsFile) {
      throw new Error('--seen-ids-file is required when --new-only is set');
    }

    const seenIds = readSeenIds(c.options.seenIdsFile);
    const newUsers = allUsers.filter((user) => !seenIds.has(user.id));

    return c.ok({ users: newUsers, count: newUsers.length });
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
  examples: [{ args: { username: 'jack' }, description: 'List accounts jack follows' }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const userRes = await resolveUser(client, c.args.username);
    const userId = userRes.data.id;
    const allUsers = await collectPaged(
      (limit, cursor) => client.getUserFollowing(userId, limit, cursor),
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
      1000,
    );

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
  examples: [{ args: { username: 'jack' }, description: "Get jack's recent posts" }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const userRes = await resolveUser(client, c.args.username);
    const userId = userRes.data.id;
    const allPosts = await collectPaged(
      (limit, cursor) => client.getUserPosts(userId, limit, cursor),
      (
        post,
      ): {
        id: string;
        text: string;
        created_at: string | undefined;
        likes: number | undefined;
        retweets: number | undefined;
      } => ({
        id: post.id,
        text: c.options.verbose ? post.text : truncateText(post.text),
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

users.command('mentions', {
  description: 'List recent mentions of a user.',
  args: z.object({
    username: z.string().describe('Username or user ID'),
  }),
  options: z.object({
    maxResults: z.number().default(10).describe('Maximum mentions to return'),
    verbose: z.boolean().optional().describe('Show full text'),
  }),
  alias: { maxResults: 'n' },
  env: xApiReadEnv,
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
  examples: [{ args: { username: 'jack' }, description: 'Get mentions of jack' }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const userRes = await resolveUser(client, c.args.username);
    const userId = userRes.data.id;
    const allPosts = await collectPaged(
      (limit, cursor) => client.getUserMentions(userId, limit, cursor),
      (post): { id: string; text: string; created_at: string | undefined } => ({
        id: post.id,
        text: c.options.verbose ? post.text : truncateText(post.text),
        created_at: post.created_at ? relativeTime(post.created_at) : undefined,
      }),
      c.options.maxResults,
    );

    return c.ok({ posts: allPosts, count: allPosts.length });
  },
});

users.command('search', {
  description: 'Search for users by keyword.',
  args: z.object({
    query: z.string().describe('Search query'),
  }),
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
  examples: [{ args: { query: 'TypeScript' }, description: 'Search for users about TypeScript' }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
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
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: first
              ? {
                  description: 'Next steps:',
                  commands: [
                    {
                      command: 'users get',
                      args: { username: first.username },
                      description: `View @${first.username}'s profile`,
                    },
                  ],
                }
              : undefined,
          },
    );
  },
});

export { users };
