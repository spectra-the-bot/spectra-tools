import { Cli, z } from 'incur';
import { createXApiClient, relativeTime, truncateText } from '../api.js';
import { readAuthToken, xApiReadEnv } from '../auth.js';
import { collectPaged } from '../collect-paged.js';

const lists = Cli.create('lists', {
  description: 'Manage and browse X lists.',
});

lists.command('get', {
  description: 'Get a list by ID.',
  args: z.object({
    id: z.string().describe('List ID'),
  }),
  env: xApiReadEnv,
  output: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    owner_id: z.string().optional(),
    member_count: z.number().optional(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Get list details' }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const res = await client.getList(c.args.id);
    const list = res.data;
    return c.ok(
      {
        id: list.id,
        name: list.name,
        description: list.description,
        owner_id: list.owner_id,
        member_count: list.member_count,
      },
      {
        cta: {
          description: 'Explore this list:',
          commands: [
            { command: 'lists members', args: { id: c.args.id }, description: 'See list members' },
            { command: 'lists posts', args: { id: c.args.id }, description: 'See list posts' },
          ],
        },
      },
    );
  },
});

lists.command('members', {
  description: 'List members of an X list.',
  args: z.object({
    id: z.string().describe('List ID'),
  }),
  options: z.object({
    maxResults: z.number().default(100).describe('Maximum members to return'),
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
  examples: [{ args: { id: '1234567890' }, description: 'List all members' }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const allUsers = await collectPaged(
      (limit, cursor) => client.getListMembers(c.args.id, limit, cursor),
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

lists.command('posts', {
  description: 'Get posts from an X list.',
  args: z.object({
    id: z.string().describe('List ID'),
  }),
  options: z.object({
    maxResults: z.number().default(25).describe('Maximum posts to return'),
    verbose: z.boolean().optional().describe('Show full text'),
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
      }),
    ),
    count: z.number(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Get posts from a list' }],
  async run(c) {
    const client = createXApiClient(readAuthToken(c.env));
    const allPosts = await collectPaged(
      (limit, cursor) => client.getListPosts(c.args.id, limit, cursor),
      (
        post,
      ): {
        id: string;
        text: string;
        author_id: string | undefined;
        created_at: string | undefined;
        likes: number | undefined;
      } => ({
        id: post.id,
        text: c.options.verbose ? post.text : truncateText(post.text),
        author_id: post.author_id,
        created_at: post.created_at ? relativeTime(post.created_at) : undefined,
        likes: post.public_metrics?.like_count,
      }),
      c.options.maxResults,
    );

    const firstId = allPosts[0]?.id;
    return c.ok(
      { posts: allPosts, count: allPosts.length },
      {
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

export { lists };
