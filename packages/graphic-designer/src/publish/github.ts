import { readFile } from 'node:fs/promises';
import { basename, posix } from 'node:path';
import type { RetryOptions } from '@spectratools/cli-shared/middleware';
import { withRetry } from '@spectratools/cli-shared/middleware';
import { HttpError, createHttpClient } from '@spectratools/cli-shared/utils';

export type GitHubPublishOptions = {
  imagePath: string;
  metadataPath: string;
  repo: string;
  pathPrefix?: string;
  branch?: string;
  token?: string;
  commitMessage?: string;
  retryPolicy?: RetryOptions;
};

export type GitHubPublishResult = {
  target: 'github';
  repo: string;
  branch: string;
  files: Array<{
    path: string;
    htmlUrl?: string;
    sha?: string;
  }>;
};

type ExistingContent = {
  sha: string;
};

type PutContentResponse = {
  content?: {
    path?: string;
    sha?: string;
    html_url?: string;
  };
};

function requireGitHubToken(token?: string): string {
  const resolved = token ?? process.env.GITHUB_TOKEN;
  if (!resolved) {
    throw new Error('GITHUB_TOKEN is required for GitHub publish adapter.');
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

function parseRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid repo "${repo}". Expected owner/name.`);
  }
  return { owner, name };
}

function toApiContentPath(repo: string, filePath: string): string {
  const { owner, name } = parseRepo(repo);
  return `/repos/${owner}/${name}/contents/${filePath}`;
}

function normalizePath(pathPrefix: string | undefined, filename: string): string {
  const trimmed = (pathPrefix ?? 'artifacts').replace(/^\/+|\/+$/gu, '');
  return posix.join(trimmed, filename);
}

async function githubJsonMaybe<T>(
  path: string,
  token: string,
  retry: RetryOptions,
): Promise<{ found: boolean; value?: T }> {
  return withRetry(async () => {
    try {
      const value = await github.request<T>(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { found: true as const, value };
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) {
        return { found: false as const };
      }
      throw err;
    }
  }, retry);
}

/**
 * Publish rendered design artifacts to a GitHub repository.
 *
 * Uploads the PNG image and sidecar `.meta.json` metadata to the specified
 * repository via the GitHub Contents API. Files are placed under
 * {@link GitHubPublishOptions.pathPrefix} (defaults to `"artifacts"`). If a
 * file already exists at the destination it is updated in-place (its SHA is
 * fetched first for the update).
 *
 * Requires a GitHub token — either passed via
 * {@link GitHubPublishOptions.token} or resolved from the `GITHUB_TOKEN`
 * environment variable.
 *
 * @param options - Publish configuration including file paths, target repo,
 *   branch, commit message, and optional retry policy.
 * @returns A {@link GitHubPublishResult} with the repo, branch, and per-file
 *   metadata (path, SHA, HTML URL).
 * @throws When no GitHub token is available or the API request fails.
 */
export async function publishToGitHub(options: GitHubPublishOptions): Promise<GitHubPublishResult> {
  const token = requireGitHubToken(options.token);
  const branch = options.branch ?? 'main';
  const retry = options.retryPolicy ?? DEFAULT_RETRY;
  const commitMessage =
    options.commitMessage ?? 'chore(graphic-designer): publish deterministic artifacts';

  const [imageBuffer, metadataBuffer] = await Promise.all([
    readFile(options.imagePath),
    readFile(options.metadataPath),
  ]);

  const uploads = [
    {
      sourcePath: options.imagePath,
      destination: normalizePath(options.pathPrefix, basename(options.imagePath)),
      content: imageBuffer.toString('base64'),
    },
    {
      sourcePath: options.metadataPath,
      destination: normalizePath(options.pathPrefix, basename(options.metadataPath)),
      content: metadataBuffer.toString('base64'),
    },
  ];

  const files: GitHubPublishResult['files'] = [];

  for (const upload of uploads) {
    const existingPath = `${toApiContentPath(options.repo, upload.destination)}?ref=${encodeURIComponent(branch)}`;
    const existing = await githubJsonMaybe<ExistingContent>(existingPath, token, retry);

    const body = {
      message: `${commitMessage} (${basename(upload.sourcePath)})`,
      content: upload.content,
      branch,
      sha: existing.value?.sha,
    };

    const putPath = toApiContentPath(options.repo, upload.destination);
    const published = await withRetry(
      () =>
        github.request<PutContentResponse>(putPath, {
          method: 'PUT',
          body,
          headers: { Authorization: `Bearer ${token}` },
        }),
      retry,
    );

    files.push({
      path: upload.destination,
      ...(published.content?.sha ? { sha: published.content.sha } : {}),
      ...(published.content?.html_url ? { htmlUrl: published.content.html_url } : {}),
    });
  }

  return {
    target: 'github',
    repo: options.repo,
    branch,
    files,
  };
}
