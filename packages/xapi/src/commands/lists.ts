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

const lists = Cli.create('lists', {
  description: 'Manage and browse X lists.',
});

const listIdSchema = z.string().min(1).describe('List ID');
const memberSchema = z
  .string()
  .trim()
  .min(1)
  .describe('Member to target (username with or without @, or user ID)');

const createListOptionsSchema = z.object({
  name: z.string().trim().min(1).max(25).describe('List name (1-25 characters)'),
  description: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe('Optional list description (1-100 characters)'),
  private: z.boolean().default(false).describe('Create as a private list'),
});

async function resolveMemberTarget(
  client: ReturnType<typeof createXApiClient>,
  usernameOrId: string,
): Promise<{ id: string; username?: string }> {
  const normalized = usernameOrId.replace(/^@/, '');
  if (/^\d+$/.test(normalized)) {
    return { id: normalized };
  }

  const user = await client.getUserByUsername(normalized);
  return {
    id: user.data.id,
    username: user.data.username,
  };
}

lists.command('get', {
  description: 'Get a list by ID.',
  args: z.object({
    id: listIdSchema,
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
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              description: 'Explore this list:',
              commands: [
                {
                  command: 'lists members',
                  args: { id: c.args.id },
                  description: 'See list members',
                },
                {
                  command: 'lists posts',
                  args: { id: c.args.id },
                  description: 'See list posts',
                },
              ],
            },
          },
    );
  },
});

lists.command('create', {
  description: 'Create a new list.',
  options: createListOptionsSchema,
  env: xApiWriteEnv,
  output: z.object({
    id: z.string(),
    name: z.string(),
  }),
  examples: [
    {
      options: { name: 'Core devs', description: 'Builders only', private: true },
      description: 'Create a private list',
    },
  ],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const res = await client.createList(c.options.name, c.options.description, c.options.private);
      return c.ok(
        res.data,
        c.format === 'json' || c.format === 'jsonl'
          ? undefined
          : {
              cta: {
                description: 'Next steps:',
                commands: [
                  {
                    command: 'lists get',
                    args: { id: res.data.id },
                    description: 'View the list details',
                  },
                  {
                    command: 'lists add-member',
                    args: { id: res.data.id, member: 'username-or-id' },
                    description: 'Add members to the new list',
                  },
                ],
              },
            },
      );
    } catch (error) {
      const authError = toWriteAuthError('lists create', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

lists.command('delete', {
  description: 'Delete a list by ID.',
  args: z.object({
    id: listIdSchema.describe('List ID to delete'),
  }),
  env: xApiWriteEnv,
  output: z.object({
    deleted: z.boolean(),
    id: z.string(),
  }),
  examples: [{ args: { id: '1234567890' }, description: 'Delete a list' }],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const res = await client.deleteList(c.args.id);
      return c.ok({ deleted: res.data.deleted, id: c.args.id });
    } catch (error) {
      const authError = toWriteAuthError('lists delete', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

lists.command('add-member', {
  description: 'Add a member to an X list.',
  args: z.object({
    id: listIdSchema,
    member: memberSchema,
  }),
  env: xApiWriteEnv,
  output: z.object({
    id: z.string(),
    member_id: z.string(),
    member_username: z.string().optional(),
    is_member: z.boolean(),
  }),
  examples: [
    {
      args: { id: '1234567890', member: 'jack' },
      description: 'Add @jack to a list',
    },
  ],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const member = await resolveMemberTarget(client, c.args.member);
      const res = await client.addListMember(c.args.id, member.id);

      return c.ok(
        {
          id: c.args.id,
          member_id: member.id,
          member_username: member.username,
          is_member: res.data.is_member,
        },
        c.format === 'json' || c.format === 'jsonl'
          ? undefined
          : {
              cta: {
                description: 'Verify list membership:',
                commands: [
                  {
                    command: 'lists members',
                    args: { id: c.args.id },
                    description: 'View current list members',
                  },
                ],
              },
            },
      );
    } catch (error) {
      const authError = toWriteAuthError('lists add-member', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

lists.command('remove-member', {
  description: 'Remove a member from an X list.',
  args: z.object({
    id: listIdSchema,
    member: memberSchema,
  }),
  env: xApiWriteEnv,
  output: z.object({
    id: z.string(),
    member_id: z.string(),
    member_username: z.string().optional(),
    is_member: z.boolean(),
  }),
  examples: [
    {
      args: { id: '1234567890', member: 'jack' },
      description: 'Remove @jack from a list',
    },
  ],
  async run(c) {
    try {
      const client = createXApiClient(writeAuthToken(c.env));
      const member = await resolveMemberTarget(client, c.args.member);
      const res = await client.removeListMember(c.args.id, member.id);

      return c.ok(
        {
          id: c.args.id,
          member_id: member.id,
          member_username: member.username,
          is_member: res.data.is_member,
        },
        c.format === 'json' || c.format === 'jsonl'
          ? undefined
          : {
              cta: {
                description: 'Next steps:',
                commands: [
                  {
                    command: 'lists members',
                    args: { id: c.args.id },
                    description: 'Confirm updated membership',
                  },
                ],
              },
            },
      );
    } catch (error) {
      const authError = toWriteAuthError('lists remove-member', error);
      if (authError) return c.error(authError);
      throw error;
    }
  },
});

lists.command('members', {
  description: 'List members of an X list.',
  args: z.object({
    id: listIdSchema,
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
    id: listIdSchema,
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

export { lists };
