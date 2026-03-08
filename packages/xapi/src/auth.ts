import { HttpError, MissingApiKeyError, apiKeyAuth } from '@spectratools/cli-shared';
import { z } from 'incur';

export const xApiEnv = z.object({
  X_BEARER_TOKEN: z.string().optional().describe('X app-only bearer token (read-only endpoints)'),
  X_ACCESS_TOKEN: z
    .string()
    .optional()
    .describe('X OAuth 2.0 user access token (required for write endpoints)'),
});

export function readAuthToken(): string {
  const userToken = process.env.X_ACCESS_TOKEN;
  if (userToken) {
    return userToken;
  }

  const { apiKey } = apiKeyAuth('X_BEARER_TOKEN');
  return apiKey;
}

export function writeAuthToken(): string {
  const { apiKey } = apiKeyAuth('X_ACCESS_TOKEN');
  return apiKey;
}

function parseXApiErrorDetail(body: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) {
      return undefined;
    }

    const candidate = parsed as {
      detail?: unknown;
      title?: unknown;
      errors?: Array<{ message?: unknown; detail?: unknown }>;
    };

    if (typeof candidate.detail === 'string' && candidate.detail.trim()) return candidate.detail;
    if (typeof candidate.title === 'string' && candidate.title.trim()) return candidate.title;

    const firstError = candidate.errors?.[0];
    if (typeof firstError?.message === 'string' && firstError.message.trim())
      return firstError.message;
    if (typeof firstError?.detail === 'string' && firstError.detail.trim())
      return firstError.detail;
  } catch {
    // Ignore non-JSON error bodies.
  }

  return undefined;
}

export function toWriteAuthError(
  operation: string,
  error: unknown,
): { code: string; message: string } | undefined {
  if (error instanceof MissingApiKeyError) {
    return {
      code: 'WRITE_AUTH_REQUIRED',
      message: [
        'Write auth required:',
        `- operation: ${operation}`,
        '- set env var: X_ACCESS_TOKEN (OAuth 2.0 user token)',
        '- note: X_BEARER_TOKEN is read-only and cannot perform write actions',
      ].join('\n'),
    };
  }

  if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
    const detail = parseXApiErrorDetail(error.body);

    return {
      code: 'INSUFFICIENT_WRITE_AUTH',
      message: [
        'Insufficient auth for write endpoint:',
        `- operation: ${operation}`,
        `- status: ${error.status} ${error.statusText}`,
        '- required auth: X_ACCESS_TOKEN (OAuth 2.0 user token with write scopes)',
        '- note: app-only X_BEARER_TOKEN cannot perform write actions',
        ...(detail ? [`- x_api_detail: ${detail}`] : []),
      ].join('\n'),
    };
  }

  return undefined;
}
