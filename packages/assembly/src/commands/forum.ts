import { Cli, z } from 'incur';
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

export const forum = Cli.create('forum', {
  description: 'Browse the Assembly governance forum.',
});

forum.command('posts', {
  description: 'List forum posts.',
  options: z.object({
    category: z
      .enum(['governance', 'general', 'all'])
      .optional()
      .default('all')
      .describe('Filter posts by category'),
  }),
  env: assemblyEnv,
  examples: [
    { description: 'List all forum posts' },
    { options: { category: 'governance' }, description: 'List governance posts' },
  ],
  run(c) {
    const client = getClient(c.env);
    const category = c.options.category === 'all' ? undefined : c.options.category;
    return client.forum
      .posts(category)
      .then((data) =>
        c.ok(
          data.map((p) => ({
            id: p.id,
            title: p.title,
            category: p.category,
            author: p.author,
            createdAt: new Date(p.createdAt * 1000).toISOString(),
            excerpt: p.excerpt,
          })),
          {
            cta: {
              description: 'View a post:',
              commands: [{ command: 'forum post', args: { id: '<id>' } }],
            },
          },
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch forum posts: ${message}`,
          retryable: true,
        });
      });
  },
});

forum.command('post', {
  description: 'Get a specific forum post.',
  args: z.object({
    id: z.string().describe('Post ID'),
  }),
  env: assemblyEnv,
  examples: [{ args: { id: '123' }, description: 'Get forum post #123' }],
  run(c) {
    const client = getClient(c.env);
    return client.forum
      .post(c.args.id)
      .then((data) =>
        c.ok({
          id: data.id,
          title: data.title,
          category: data.category,
          author: data.author,
          createdAt: new Date(data.createdAt * 1000).toISOString(),
          excerpt: data.excerpt,
        }),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to fetch forum post ${c.args.id}: ${message}`,
          retryable: true,
        });
      });
  },
});

forum.command('search', {
  description: 'Search forum posts.',
  args: z.object({
    query: z.string().describe('Search query'),
  }),
  env: assemblyEnv,
  examples: [
    { args: { query: 'governance token' }, description: 'Search for governance token posts' },
  ],
  run(c) {
    const client = getClient(c.env);
    return client.forum
      .search(c.args.query)
      .then((data) =>
        c.ok(
          data.map((p) => ({
            id: p.id,
            title: p.title,
            category: p.category,
            author: p.author,
            createdAt: new Date(p.createdAt * 1000).toISOString(),
            excerpt: p.excerpt,
          })),
          {
            cta: {
              description: 'View a post:',
              commands: [{ command: 'forum post', args: { id: '<id>' } }],
            },
          },
        ),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        return c.error({
          code: 'FETCH_ERROR',
          message: `Failed to search forum: ${message}`,
          retryable: true,
        });
      });
  },
});
