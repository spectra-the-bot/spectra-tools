import { Cli, z } from 'incur';
import { createFigmaClient } from '../api.js';
import { figmaEnv, fileKeyArg, formatOption, outputFormatter } from './_common.js';

export const commentsCli = Cli.create('comments', {
  description: 'List and post comments on Figma files.',
});

// ---------------------------------------------------------------------------
// comments list
// ---------------------------------------------------------------------------

commentsCli.command('list', {
  description: 'List all comments on a Figma file.',
  args: z.object({ fileKey: fileKeyArg }),
  options: z.object({ format: formatOption }),
  env: figmaEnv,
  output: z.unknown(),
  examples: [
    {
      args: { fileKey: 'abc123' },
      options: { format: 'json' },
      description: 'List comments as JSON',
    },
    {
      args: { fileKey: 'abc123' },
      options: { format: 'table' },
      description: 'List comments as table',
    },
  ],
  async run(c) {
    const fileKey = c.args.fileKey;
    const client = createFigmaClient(c.env.FIGMA_API_KEY);

    const response = await client.getComments(fileKey);

    const comments = response.comments.map((comment) => ({
      id: comment.id,
      author: comment.user.handle,
      message: comment.message,
      createdAt: comment.created_at,
      resolved: comment.resolved_at != null,
      nodeId: comment.client_meta?.node_id ?? null,
    }));

    if (comments.length === 0) {
      return c.ok(
        c.options.format === 'json'
          ? { comments: [], message: 'No comments found.' }
          : 'No comments found.',
      );
    }

    if (c.options.format === 'json') {
      return c.ok({ comments, total: comments.length });
    }

    return c.ok(
      outputFormatter(
        comments.map((co) => ({
          id: co.id,
          author: co.author,
          message: co.message.length > 50 ? `${co.message.slice(0, 47)}...` : co.message,
          createdAt: co.createdAt,
          resolved: co.resolved ? 'yes' : 'no',
          nodeId: co.nodeId ?? '-',
        })),
        'table',
      ),
    );
  },
});

// ---------------------------------------------------------------------------
// comments post
// ---------------------------------------------------------------------------

commentsCli.command('post', {
  description: 'Post a comment on a Figma file.',
  args: z.object({ fileKey: fileKeyArg }),
  options: z.object({
    message: z.string().describe('Comment text (required)'),
    'node-id': z.string().optional().describe('Pin comment to a specific node ID'),
  }),
  env: figmaEnv,
  output: z.unknown(),
  examples: [
    {
      args: { fileKey: 'abc123' },
      options: { message: 'Looks good!' },
      description: 'Post a general comment',
    },
    {
      args: { fileKey: 'abc123' },
      options: { message: 'Check this spacing', 'node-id': '1:42' },
      description: 'Post a comment pinned to a node',
    },
  ],
  async run(c) {
    const fileKey = c.args.fileKey;
    const { message, 'node-id': nodeId } = c.options;

    if (!message || message.trim().length === 0) {
      return c.error({
        code: 'VALIDATION_ERROR',
        message: '--message is required and cannot be empty',
      });
    }

    const client = createFigmaClient(c.env.FIGMA_API_KEY);
    const comment = await client.postComment(fileKey, message, nodeId);

    return c.ok({
      id: comment.id,
      message: comment.message,
      author: comment.user.handle,
      createdAt: comment.created_at,
      permalink: `https://www.figma.com/file/${fileKey}?comment=${comment.id}`,
    });
  },
});
