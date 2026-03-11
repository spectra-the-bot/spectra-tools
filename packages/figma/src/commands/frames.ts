import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Cli, z } from 'incur';
import { createFigmaClient } from '../api.js';
import { figmaEnv, fileKeyArg, formatOption, outputFormatter } from './_common.js';

export const framesCli = Cli.create('frames', {
  description: 'Export frame metadata and render frame images from Figma files.',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FrameNode {
  id: string;
  name: string;
  type: string;
  children?: FrameNode[];
  absoluteBoundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface FrameInfo {
  name: string;
  nodeId: string;
  page: string;
  width: number;
  height: number;
}

function extractFrames(document: unknown, pageFilter?: string): FrameInfo[] {
  const doc = document as { children?: FrameNode[] };
  const frames: FrameInfo[] = [];

  for (const page of doc.children ?? []) {
    if (page.type !== 'CANVAS') continue;
    if (pageFilter && page.name !== pageFilter) continue;

    for (const child of page.children ?? []) {
      if (child.type !== 'FRAME') continue;
      frames.push({
        name: child.name,
        nodeId: child.id,
        page: page.name,
        width: child.absoluteBoundingBox?.width ?? 0,
        height: child.absoluteBoundingBox?.height ?? 0,
      });
    }
  }

  return frames;
}

async function downloadFile(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---------------------------------------------------------------------------
// frames export
// ---------------------------------------------------------------------------

framesCli.command('export', {
  description: 'List all top-level frames in a Figma file.',
  args: z.object({ fileKey: fileKeyArg }),
  options: z.object({
    page: z.string().optional().describe('Filter to frames on a specific page'),
    format: formatOption,
  }),
  env: figmaEnv,
  output: z.unknown(),
  examples: [
    {
      args: { fileKey: 'abc123' },
      options: { format: 'json' },
      description: 'List frames in a file',
    },
    {
      args: { fileKey: 'abc123' },
      options: { page: 'Home', format: 'table' },
      description: 'List frames on the Home page',
    },
  ],
  async run(c) {
    const fileKey = c.args.fileKey;
    const client = createFigmaClient(c.env.FIGMA_API_KEY);

    const file = await client.getFile(fileKey);
    const frames = extractFrames(file.document, c.options.page);

    if (frames.length === 0) {
      const msg = c.options.page
        ? `No frames found on page "${c.options.page}".`
        : 'No top-level frames found in this file.';
      return c.ok(c.options.format === 'json' ? { frames: [], message: msg } : msg);
    }

    if (c.options.format === 'json') {
      return c.ok({ frames, total: frames.length });
    }

    return c.ok(outputFormatter(frames as unknown as Record<string, unknown>[], 'table'));
  },
});

// ---------------------------------------------------------------------------
// frames render
// ---------------------------------------------------------------------------

framesCli.command('render', {
  description: 'Download rendered images of specific frames from a Figma file.',
  args: z.object({ fileKey: fileKeyArg }),
  options: z.object({
    ids: z.string().describe('Comma-separated node IDs to render'),
    'image-format': z
      .enum(['png', 'svg'])
      .default('png')
      .describe('Image format: png or svg (default: png)'),
    scale: z.coerce.number().min(1).max(4).default(2).describe('Image scale 1-4 (default: 2)'),
    output: z.string().default('.').describe('Output directory (default: current directory)'),
  }),
  env: figmaEnv,
  output: z.unknown(),
  examples: [
    {
      args: { fileKey: 'abc123' },
      options: {
        ids: '1:2,3:4',
        'image-format': 'png',
        scale: 2,
        output: '.',
      },
      description: 'Render frames as 2x PNG',
    },
  ],
  async run(c) {
    const fileKey = c.args.fileKey;
    const { ids, 'image-format': imageFormat, scale, output: outputDir } = c.options;
    const client = createFigmaClient(c.env.FIGMA_API_KEY);

    const nodeIds = ids.split(',').map((id) => id.trim());
    if (nodeIds.length === 0 || (nodeIds.length === 1 && nodeIds[0] === '')) {
      return c.error({
        code: 'VALIDATION_ERROR',
        message: '--ids is required and cannot be empty',
      });
    }

    const imagesResponse = await client.getImages(fileKey, nodeIds, {
      format: imageFormat,
      scale,
    });

    if (imagesResponse.err) {
      return c.error({
        code: 'FIGMA_API_ERROR',
        message: imagesResponse.err,
      });
    }

    const resolvedDir = resolve(outputDir);
    if (!existsSync(resolvedDir)) {
      mkdirSync(resolvedDir, { recursive: true });
    }

    const results: { nodeId: string; file: string; size: number }[] = [];

    // Download sequentially to respect rate limits
    for (const nodeId of nodeIds) {
      const imageUrl = imagesResponse.images[nodeId];
      if (!imageUrl) {
        results.push({ nodeId, file: '(no image)', size: 0 });
        continue;
      }

      const safeNodeId = nodeId.replace(/:/g, '-');
      const filename = `${safeNodeId}.${imageFormat}`;
      const filepath = resolve(resolvedDir, filename);

      const buffer = await downloadFile(imageUrl);
      writeFileSync(filepath, buffer);

      results.push({ nodeId, file: filepath, size: buffer.length });
    }

    return c.ok({ rendered: results, total: results.length });
  },
});
