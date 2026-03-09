import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { type RetryPolicy, withRetry } from '../utils/retry.js';

export type GistPublishOptions = {
  imagePath: string;
  metadataPath: string;
  gistId?: string;
  description?: string;
  filenamePrefix?: string;
  public?: boolean;
  token?: string;
  retryPolicy?: RetryPolicy;
};

export type GistPublishResult = {
  target: 'gist';
  gistId: string;
  htmlUrl: string;
  attempts: number;
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

async function gistJson<T>(
  path: string,
  init: RequestInit,
  token: string,
  retryPolicy?: RetryPolicy,
): Promise<{ value: T; attempts: number }> {
  return withRetry(async () => {
    const response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'spectratools-graphic-designer',
        ...init.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitHub Gist API ${path} failed (${response.status}): ${text || response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }, retryPolicy);
}

export async function publishToGist(options: GistPublishOptions): Promise<GistPublishResult> {
  const token = requireGitHubToken(options.token);

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

  const published = await gistJson<GistResponse>(
    endpoint,
    {
      method,
      body: JSON.stringify(payload),
    },
    token,
    options.retryPolicy,
  );

  return {
    target: 'gist',
    gistId: published.value.id,
    htmlUrl: published.value.html_url,
    attempts: published.attempts,
    files: Object.keys(published.value.files ?? payload.files),
  };
}
