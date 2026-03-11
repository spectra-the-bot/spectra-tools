import { Cli, z } from 'incur';
import { createFigmaClient } from '../api.js';
import { figmaEnv } from '../auth.js';

export const componentsCli = Cli.create('components', {
  description: 'List and inspect published Figma components.',
});

const componentOutputSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
});

componentsCli.command('list', {
  description: 'List published components in a Figma file.',
  args: z.object({
    fileKey: z.string().describe('Figma file key'),
  }),
  options: z.object({}),
  env: figmaEnv,
  output: z.object({
    components: z.array(componentOutputSchema),
    total: z.number(),
  }),
  examples: [
    {
      args: { fileKey: 'abc123FileKey' },
      options: {},
      description: 'List all published components',
    },
  ],
  async run(c) {
    const { fileKey } = c.args;
    const client = createFigmaClient(c.env.FIGMA_API_KEY);
    const response = await client.getFileComponents(fileKey);
    const components = response.meta.components;

    return c.ok(
      {
        components: components.map((comp) => ({
          key: comp.key,
          name: comp.name,
          description: comp.description,
        })),
        total: components.length,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              commands:
                components.length > 0
                  ? [
                      {
                        command: `components get ${fileKey} ${components[0]?.key}`,
                        description: `Get details for "${components[0]?.name}"`,
                      },
                    ]
                  : [
                      {
                        command: `tokens export ${fileKey}`,
                        description: 'Export design tokens from this file',
                      },
                    ],
            },
          },
    );
  },
});

componentsCli.command('get', {
  description: 'Get details for a specific published component.',
  args: z.object({
    fileKey: z.string().describe('Figma file key'),
    componentKey: z.string().describe('Component key'),
  }),
  options: z.object({}),
  env: figmaEnv,
  output: z.object({
    key: z.string(),
    name: z.string(),
    description: z.string(),
    found: z.boolean(),
  }),
  examples: [
    {
      args: { fileKey: 'abc123FileKey', componentKey: 'comp:456' },
      options: {},
      description: 'Get details for a specific component',
    },
  ],
  async run(c) {
    const { fileKey, componentKey } = c.args;
    const client = createFigmaClient(c.env.FIGMA_API_KEY);
    const response = await client.getFileComponents(fileKey);
    const match = response.meta.components.find((comp) => comp.key === componentKey);

    if (!match) {
      return c.ok(
        {
          key: componentKey,
          name: '',
          description: '',
          found: false,
        },
        c.format === 'json' || c.format === 'jsonl'
          ? undefined
          : {
              cta: {
                commands: [
                  {
                    command: `components list ${fileKey}`,
                    description: 'List all available components',
                  },
                ],
              },
            },
      );
    }

    return c.ok(
      {
        key: match.key,
        name: match.name,
        description: match.description,
        found: true,
      },
      c.format === 'json' || c.format === 'jsonl'
        ? undefined
        : {
            cta: {
              commands: [
                {
                  command: `components list ${fileKey}`,
                  description: 'List all components',
                },
                {
                  command: `tokens export ${fileKey}`,
                  description: 'Export design tokens',
                },
              ],
            },
          },
    );
  },
});
