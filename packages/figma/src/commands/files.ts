import { Cli, z } from 'incur';
import { createFigmaClient } from '../api.js';
import { figmaEnv, fileKeyArg, formatOption, outputFormatter } from './_common.js';

// ---------------------------------------------------------------------------
// Output schemas
// ---------------------------------------------------------------------------

const pageSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const fileGetOutputSchema = z.object({
  name: z.string(),
  lastModified: z.string(),
  version: z.string(),
  thumbnailUrl: z.string().optional(),
  pages: z.array(pageSchema),
});

const projectFileOutputSchema = z.object({
  key: z.string(),
  name: z.string(),
  lastModified: z.string(),
  thumbnailUrl: z.string().optional(),
});

const filesListOutputSchema = z.object({
  projectName: z.string(),
  files: z.array(projectFileOutputSchema),
  count: z.number(),
});

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export const filesCli = Cli.create('files', {
  description: 'Query Figma file metadata.',
});

filesCli.command('get', {
  description: 'Get metadata for a Figma file.',
  args: z.object({
    fileKey: fileKeyArg,
  }),
  options: z.object({
    format: formatOption,
  }),
  env: figmaEnv,
  output: fileGetOutputSchema,
  examples: [
    {
      args: { fileKey: 'abc123XYZ' },
      description: 'Get file metadata for a Figma file',
    },
  ],
  async run(c) {
    const client = createFigmaClient(c.env.FIGMA_API_KEY);
    const file = await client.getFile(c.args.fileKey, { depth: 1 });

    // Extract pages from the top-level document children
    const doc = file.document as { children?: Array<{ id: string; name: string }> } | undefined;
    const pages: Array<{ id: string; name: string }> =
      doc?.children?.map((child) => ({ id: child.id, name: child.name })) ?? [];

    const result = {
      name: file.name,
      lastModified: file.lastModified,
      version: file.version,
      thumbnailUrl: undefined as string | undefined,
      pages,
    };

    if (c.options.format === 'table') {
      process.stdout.write(
        `${outputFormatter(result as unknown as Record<string, unknown>, 'table')}\n`,
      );
    }

    return c.ok(
      result,
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              commands: [
                {
                  command: 'nodes get',
                  args: { fileKey: c.args.fileKey, nodeId: pages[0]?.id ?? '<node-id>' },
                  description: 'Inspect a node in this file',
                },
              ],
            },
          },
    );
  },
});

filesCli.command('list', {
  description: 'List files in a Figma project.',
  options: z.object({
    'project-id': z.string().describe('Figma project ID'),
    format: formatOption,
  }),
  env: figmaEnv,
  output: filesListOutputSchema,
  examples: [
    {
      options: { 'project-id': '12345' },
      description: 'List files in a Figma project',
    },
  ],
  async run(c) {
    const projectId = c.options['project-id'];
    const client = createFigmaClient(c.env.FIGMA_API_KEY);
    const project = await client.getProjectFiles(projectId);

    const files = project.files.map((f) => ({
      key: f.key,
      name: f.name,
      lastModified: f.last_modified,
      thumbnailUrl: f.thumbnail_url,
    }));

    const result = {
      projectName: project.name,
      files,
      count: files.length,
    };

    if (c.options.format === 'table') {
      process.stdout.write(`${outputFormatter(files, 'table')}\n`);
    }

    return c.ok(
      result,
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              commands: files[0]
                ? [
                    {
                      command: 'files get',
                      args: { fileKey: files[0].key },
                      description: `Get metadata for "${files[0].name}"`,
                    },
                  ]
                : [],
            },
          },
    );
  },
});
