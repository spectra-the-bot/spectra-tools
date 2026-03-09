import { readFile } from 'node:fs/promises';
import { basename, posix } from 'node:path';
import { type RetryPolicy, withRetry } from '../utils/retry.js';

export type GitHubPublishOptions = {
  imagePath: string;
  metadataPath: string;
  repo: string;
  pathPrefix?: string;
  branch?: string;
  token?: string;
  commitMessage?: string;
  retryPolicy?: RetryPolicy;
};

export type GitHubPublishResult = {
  target: 'github';
  repo: string;
  branch: string;
  attempts: number;
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

async function githubJson<T>(
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
        `GitHub API ${path} failed (${response.status}): ${text || response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }, retryPolicy);
}

async function githubJsonMaybe<T>(
  path: string,
  token: string,
  retryPolicy?: RetryPolicy,
): Promise<{ found: boolean; value?: T; attempts: number }> {
  const { value, attempts } = await withRetry(async () => {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'spectratools-graphic-designer',
      },
    });

    if (response.status === 404) {
      return { found: false as const };
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitHub API ${path} failed (${response.status}): ${text || response.statusText}`,
      );
    }

    const json = (await response.json()) as T;
    return { found: true as const, value: json };
  }, retryPolicy);

  if (!value.found) {
    return { found: false, attempts };
  }

  return {
    found: true,
    value: value.value,
    attempts,
  };
}

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

export async function publishToGitHub(options: GitHubPublishOptions): Promise<GitHubPublishResult> {
  const token = requireGitHubToken(options.token);
  const branch = options.branch ?? 'main';
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

  let totalAttempts = 0;
  const files: GitHubPublishResult['files'] = [];

  for (const upload of uploads) {
    const existingPath = `${toApiContentPath(options.repo, upload.destination)}?ref=${encodeURIComponent(branch)}`;
    const existing = await githubJsonMaybe<ExistingContent>(
      existingPath,
      token,
      options.retryPolicy,
    );
    totalAttempts += existing.attempts;

    const body = {
      message: `${commitMessage} (${basename(upload.sourcePath)})`,
      content: upload.content,
      branch,
      sha: existing.value?.sha,
    };

    const putPath = toApiContentPath(options.repo, upload.destination);
    const published = await githubJson<PutContentResponse>(
      putPath,
      {
        method: 'PUT',
        body: JSON.stringify(body),
      },
      token,
      options.retryPolicy,
    );
    totalAttempts += published.attempts;

    files.push({
      path: upload.destination,
      ...(published.value.content?.sha ? { sha: published.value.content.sha } : {}),
      ...(published.value.content?.html_url ? { htmlUrl: published.value.content.html_url } : {}),
    });
  }

  return {
    target: 'github',
    repo: options.repo,
    branch,
    attempts: totalAttempts,
    files,
  };
}
