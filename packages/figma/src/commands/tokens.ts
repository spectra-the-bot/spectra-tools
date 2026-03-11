import { writeFileSync } from 'node:fs';
import { Cli, z } from 'incur';
import { createFigmaClient } from '../api.js';
import { figmaEnv } from '../auth.js';
import { toDtcg } from '../tokens/dtcg.js';
import { type TokenFilter, extractTokens, toFlatTokens } from '../tokens/extractor.js';

export const tokensCli = Cli.create('tokens', {
  description: 'Extract design tokens from Figma files.',
});

const formatOption = z
  .enum(['dtcg', 'flat', 'json'])
  .default('dtcg')
  .describe('Output format: dtcg (W3C DTCG), flat (key-value), json (raw intermediate)');

const filterOption = z
  .enum(['colors', 'typography', 'effects'])
  .optional()
  .describe('Extract only specific token types');

const outputOption = z.string().optional().describe('Write output to file instead of stdout');

tokensCli.command('export', {
  description: 'Extract design tokens from a Figma file.',
  args: z.object({
    fileKey: z.string().describe('Figma file key'),
  }),
  options: z.object({
    format: formatOption,
    filter: filterOption,
    output: outputOption,
  }),
  env: figmaEnv,
  output: z.unknown(),
  examples: [
    {
      args: { fileKey: 'abc123FileKey' },
      options: { format: 'dtcg' },
      description: 'Export tokens in DTCG format',
    },
    {
      args: { fileKey: 'abc123FileKey' },
      options: { format: 'flat', filter: 'colors' },
      description: 'Export only color tokens in flat format',
    },
  ],
  async run(c) {
    const { fileKey } = c.args;
    const client = createFigmaClient(c.env.FIGMA_API_KEY);

    // Fetch full file to get document tree + styles map
    const file = await client.getFile(fileKey);
    const tokens = extractTokens(
      file.document,
      file.styles as
        | Record<string, { key: string; name: string; style_type: string; description?: string }>
        | undefined,
      c.options.filter as TokenFilter | undefined,
    );

    let result: unknown;
    if (c.options.format === 'dtcg') {
      result = toDtcg(tokens);
    } else if (c.options.format === 'flat') {
      result = toFlatTokens(tokens);
    } else {
      result = tokens;
    }

    if (c.options.output) {
      writeFileSync(c.options.output, JSON.stringify(result, null, 2), 'utf8');
      return c.ok(
        { written: c.options.output, format: c.options.format },
        c.format === 'json' || c.format === 'jsonl'
          ? undefined
          : {
              cta: {
                commands: [
                  {
                    command: `tokens export ${fileKey} --format flat`,
                    description: 'Export tokens in flat format',
                  },
                ],
              },
            },
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
                  command: `tokens export ${fileKey} --format flat`,
                  description: 'Export in flat key-value format',
                },
                {
                  command: `tokens export ${fileKey} --filter colors`,
                  description: 'Export only color tokens',
                },
                {
                  command: `components list ${fileKey}`,
                  description: 'List published components',
                },
              ],
            },
          },
    );
  },
});
