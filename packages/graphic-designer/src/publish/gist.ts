import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { RetryOptions } from '@spectratools/cli-shared/middleware';
import { withRetry } from '@spectratools/cli-shared/middleware';
import { createHttpClient } from '@spectratools/cli-shared/utils';

export type GistPublishOptions = {
  imagePath: string;
  metadataPath: string;
  gistId?: string;
  description?: string;
  filenamePrefix?: string;
  public?: boolean;
  token?: string;
  retryPolicy?: RetryOptions;
};

export type GistPublishResult = {
  target: 'gist';
  gistId: string;
  htmlUrl: string;
  files: string[];
};

type GistResponse = {
  id: string;
  html_url: string;
  files?: Record<string, unknown>;
};

function requireGitHubToken(token?: string): string {
  const resolved = token ?? process.env.GITHUB_TOKEN;
  if (!resolved) {
    throw new Error('GITHUB_TOKEN is required for gist publish adapter.');
  }
  return resolved;
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseMs: 500,
  maxMs: 4_000,
};

const github = createHttpClient({
  baseUrl: 'https://api.github.com',
  defaultHeaders: {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'spectratools-graphic-designer',
  },
});

export async function publishToGist(options: GistPublishOptions): Promise<GistPublishResult> {
  const token = requireGitHubToken(options.token);
  const retry = options.retryPolicy ?? DEFAULT_RETRY;

  const [imageBuffer, metadataBuffer] = await Promise.all([
    readFile(options.imagePath),
    readFile(options.metadataPath),
  ]);

  const prefix = options.filenamePrefix ?? basename(options.imagePath, '.png');
  const imageBase64 = imageBuffer.toString('base64');
  const metadataText = metadataBuffer.toString('utf8');

  const readmeName = `${prefix}.md`;
  const b64Name = `${prefix}.png.base64.txt`;
  const metadataName = `${prefix}.meta.json`;

  const markdown = [
    `# ${prefix}`,
    '',
    'Deterministic graphic-designer artifact.',
    '',
    `- Source image filename: ${basename(options.imagePath)}`,
    `- Sidecar metadata filename: ${metadataName}`,
    '',
    '## Preview',
    '',
    `![${prefix}](data:image/png;base64,${imageBase64})`,
    '',
    '## Notes',
    '',
    `- This gist stores the PNG as base64 in \`${b64Name}\` for deterministic transport.`,
  ].join('\n');

  const payload = {
    description: options.description ?? 'graphic-designer publish',
    public: options.public ?? false,
    files: {
      [readmeName]: { content: markdown },
      [b64Name]: { content: imageBase64 },
      [metadataName]: { content: metadataText },
    },
  };

  const endpoint = options.gistId ? `/gists/${options.gistId}` : '/gists';
  const method = options.gistId ? 'PATCH' : 'POST';

  const published = await withRetry(
    () =>
      github.request<GistResponse>(endpoint, {
        method,
        body: payload,
        headers: { Authorization: `Bearer ${token}` },
      }),
    retry,
  );

  return {
    target: 'gist',
    gistId: published.id,
    htmlUrl: published.html_url,
    files: Object.keys(published.files ?? payload.files),
  };
}
