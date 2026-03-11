import {
  createHttpClient,
  createRateLimiter,
  withRateLimit,
  withRetry,
} from '@spectratools/cli-shared';
import { z } from 'incur';

const BASE_URL = 'https://api.figma.com/v1';
const RETRY_OPTIONS = { maxRetries: 3, baseMs: 1000, maxMs: 15000 };

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const colorSchema = z.object({
  r: z.number(),
  g: z.number(),
  b: z.number(),
  a: z.number(),
});

const userSchema = z.object({
  id: z.string(),
  handle: z.string(),
  img_url: z.string().optional(),
});

const componentSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string(),
});

const styleSchema = z.object({
  key: z.string(),
  name: z.string(),
  style_type: z.string(),
  description: z.string().optional(),
});

const clientMetaSchema = z
  .object({
    node_id: z.string().optional(),
    node_offset: z.object({ x: z.number(), y: z.number() }).optional(),
  })
  .optional();

const commentSchema = z.object({
  id: z.string(),
  message: z.string(),
  created_at: z.string(),
  resolved_at: z.string().nullable().optional(),
  user: userSchema,
  order_id: z.union([z.string(), z.number()]).optional(),
  client_meta: clientMetaSchema,
});

const fileMetaSchema = z.object({
  name: z.string(),
  lastModified: z.string(),
  version: z.string(),
  role: z.string().optional(),
});

const projectFileSchema = z.object({
  key: z.string(),
  name: z.string(),
  thumbnail_url: z.string().optional(),
  last_modified: z.string(),
});

const getFileResponseSchema = z.object({
  name: z.string(),
  lastModified: z.string(),
  version: z.string(),
  role: z.string().optional(),
  document: z.unknown(),
  components: z.record(z.string(), componentSchema).optional(),
  styles: z.record(z.string(), styleSchema).optional(),
});

const getFileNodesResponseSchema = z.object({
  name: z.string(),
  lastModified: z.string(),
  version: z.string(),
  nodes: z.record(z.string(), z.unknown()),
});

const getImagesResponseSchema = z.object({
  images: z.record(z.string(), z.string().nullable()),
  err: z.string().nullable().optional(),
});

const getFileStylesResponseSchema = z.object({
  meta: z.object({
    styles: z.array(styleSchema),
  }),
});

const getFileComponentsResponseSchema = z.object({
  meta: z.object({
    components: z.array(componentSchema),
  }),
});

const getCommentsResponseSchema = z.object({
  comments: z.array(commentSchema),
});

const postCommentResponseSchema = commentSchema;

const getProjectFilesResponseSchema = z.object({
  name: z.string(),
  files: z.array(projectFileSchema),
});

// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

export interface GetFileOptions {
  /** Positive integer representing how deep to traverse the node tree. */
  depth?: number;
  /** Comma-separated list of node IDs to retrieve (sub-tree). */
  ids?: string;
  /** File version to fetch. */
  version?: string;
  /** Set to "internal" to include geometry data. */
  geometry?: string;
}

export interface GetImagesOptions {
  /** Image scale (0.01–4). */
  scale?: number;
  /** Image format: jpg, png, svg, or pdf. */
  format?: 'jpg' | 'png' | 'svg' | 'pdf';
  /** File version to export from. */
  version?: string;
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function createFigmaClient(apiKey: string) {
  const http = createHttpClient({
    baseUrl: BASE_URL,
    defaultHeaders: { 'X-Figma-Token': apiKey },
  });
  const acquire = createRateLimiter({ requestsPerSecond: 2 });

  function request<T>(
    path: string,
    schema: z.ZodType<T>,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): Promise<T> {
    const opts = query ? { query } : {};
    return withRetry(
      () => withRateLimit(() => http.request<unknown>(path, opts), acquire),
      RETRY_OPTIONS,
    ).then((raw) => schema.parse(raw));
  }

  function post<T>(path: string, schema: z.ZodType<T>, body: unknown): Promise<T> {
    return withRetry(
      () => withRateLimit(() => http.request<unknown>(path, { method: 'POST', body }), acquire),
      RETRY_OPTIONS,
    ).then((raw) => schema.parse(raw));
  }

  return {
    /** Fetch a full Figma file. */
    getFile(fileKey: string, opts?: GetFileOptions) {
      const query: Record<string, string | number | boolean | undefined> = {};
      if (opts?.depth !== undefined) query.depth = opts.depth;
      if (opts?.ids !== undefined) query.ids = opts.ids;
      if (opts?.version !== undefined) query.version = opts.version;
      if (opts?.geometry !== undefined) query.geometry = opts.geometry;
      return request(`/files/${fileKey}`, getFileResponseSchema, query);
    },

    /** Fetch specific nodes from a file. */
    getFileNodes(fileKey: string, nodeIds: string[]) {
      return request(`/files/${fileKey}/nodes`, getFileNodesResponseSchema, {
        ids: nodeIds.join(','),
      });
    },

    /** Export images for the given node IDs. */
    getImages(fileKey: string, nodeIds: string[], opts?: GetImagesOptions) {
      const query: Record<string, string | number | boolean | undefined> = {
        ids: nodeIds.join(','),
      };
      if (opts?.scale !== undefined) query.scale = opts.scale;
      if (opts?.format !== undefined) query.format = opts.format;
      if (opts?.version !== undefined) query.version = opts.version;
      return request(`/images/${fileKey}`, getImagesResponseSchema, query);
    },

    /** List published styles in a file. */
    getFileStyles(fileKey: string) {
      return request(`/files/${fileKey}/styles`, getFileStylesResponseSchema);
    },

    /** List published components in a file. */
    getFileComponents(fileKey: string) {
      return request(`/files/${fileKey}/components`, getFileComponentsResponseSchema);
    },

    /** List comments on a file. */
    getComments(fileKey: string) {
      return request(`/files/${fileKey}/comments`, getCommentsResponseSchema);
    },

    /** Post a comment on a file. */
    postComment(fileKey: string, message: string, nodeId?: string) {
      const body: Record<string, unknown> = { message };
      if (nodeId !== undefined) {
        body.client_meta = { node_id: nodeId };
      }
      return post(`/files/${fileKey}/comments`, postCommentResponseSchema, body);
    },

    /** List files in a project. */
    getProjectFiles(projectId: string) {
      return request(`/projects/${projectId}/files`, getProjectFilesResponseSchema);
    },
  };
}

// Re-export schemas for consumer use
export {
  colorSchema,
  commentSchema,
  componentSchema,
  fileMetaSchema,
  getCommentsResponseSchema,
  getFileComponentsResponseSchema,
  getFileNodesResponseSchema,
  getFileResponseSchema,
  getFileStylesResponseSchema,
  getImagesResponseSchema,
  getProjectFilesResponseSchema,
  postCommentResponseSchema,
  projectFileSchema,
  styleSchema,
  userSchema,
};
