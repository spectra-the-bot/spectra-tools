import { Cli, z } from 'incur';
import { createFigmaClient } from '../api.js';
import { figmaEnv, fileKeyArg, formatOption, outputFormatter } from './_common.js';

// ---------------------------------------------------------------------------
// Output schemas
// ---------------------------------------------------------------------------

const boundingBoxSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .optional();

const childSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
});

const nodeGetOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  boundingBox: boundingBoxSchema,
  children: z.array(childSummarySchema),
  childCount: z.number(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RawNode {
  id?: string;
  name?: string;
  type?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number };
  children?: RawNode[];
}

function summarizeChildren(
  children: RawNode[] | undefined,
  depth: number,
): Array<{ id: string; name: string; type: string }> {
  if (!children || depth <= 0) return [];
  const result: Array<{ id: string; name: string; type: string }> = [];
  for (const child of children) {
    result.push({
      id: child.id ?? '',
      name: child.name ?? '',
      type: child.type ?? 'UNKNOWN',
    });
    if (depth > 1 && child.children) {
      result.push(...summarizeChildren(child.children, depth - 1));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export const nodesCli = Cli.create('nodes', {
  description: 'Inspect Figma file nodes.',
});

nodesCli.command('get', {
  description: 'Get details for a specific node in a Figma file.',
  args: z.object({
    fileKey: fileKeyArg,
    nodeId: z.string().describe('Node ID (e.g. "1:2")'),
  }),
  options: z.object({
    depth: z.coerce
      .number()
      .default(1)
      .describe('How deep into the node tree to display children (default: 1)'),
    format: formatOption,
  }),
  env: figmaEnv,
  output: nodeGetOutputSchema,
  examples: [
    {
      args: { fileKey: 'abc123XYZ', nodeId: '1:2' },
      options: { depth: 2 },
      description: 'Inspect a node with 2 levels of children',
    },
  ],
  async run(c) {
    const client = createFigmaClient(c.env.FIGMA_API_KEY);
    const response = await client.getFileNodes(c.args.fileKey, [c.args.nodeId]);

    const nodeData = response.nodes[c.args.nodeId] as { document?: RawNode } | null | undefined;

    if (!nodeData?.document) {
      return c.error({
        code: 'NODE_NOT_FOUND',
        message: `Node "${c.args.nodeId}" not found in file "${c.args.fileKey}".`,
      });
    }

    const doc = nodeData.document;
    const bbox = doc.absoluteBoundingBox ?? doc.absoluteRenderBounds;
    const children = summarizeChildren(doc.children, c.options.depth);

    const result = {
      id: doc.id ?? c.args.nodeId,
      name: doc.name ?? '',
      type: doc.type ?? 'UNKNOWN',
      boundingBox: bbox
        ? { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
        : undefined,
      children,
      childCount: doc.children?.length ?? 0,
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
              commands: children[0]
                ? [
                    {
                      command: 'nodes get',
                      args: { fileKey: c.args.fileKey, nodeId: children[0].id },
                      description: `Inspect child node "${children[0].name}"`,
                    },
                  ]
                : [],
            },
          },
    );
  },
});
