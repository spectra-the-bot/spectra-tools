import { HttpError } from '@spectratools/cli-shared';
import { z } from 'incur';

const bearerTokenSchema = z.string().describe('X app-only bearer token (read-only endpoints)');

const accessTokenSchema = z
  .string()
  .describe('X OAuth 2.0 user access token (required for write endpoints)');

export const xApiReadEnv = z
  .object({
    X_BEARER_TOKEN: bearerTokenSchema.optional(),
    X_ACCESS_TOKEN: accessTokenSchema.optional(),
  })
  .refine((env) => Boolean(env.X_ACCESS_TOKEN || env.X_BEARER_TOKEN), {
    message: 'Set X_ACCESS_TOKEN or X_BEARER_TOKEN to authenticate X API requests.',
  });

export const xApiWriteEnv = z.object({
  X_ACCESS_TOKEN: accessTokenSchema,
  X_BEARER_TOKEN: bearerTokenSchema.optional(),
});

export type XApiReadEnv = z.infer<typeof xApiReadEnv>;
export type XApiWriteEnv = z.infer<typeof xApiWriteEnv>;

export type XApiAuthScope = 'read' | 'write';

export function readAuthToken(env: XApiReadEnv): string {
  if (env.X_ACCESS_TOKEN) {
    return env.X_ACCESS_TOKEN;
  }

  return env.X_BEARER_TOKEN as string;
}

export function writeAuthToken(env: XApiWriteEnv): string {
  return env.X_ACCESS_TOKEN;
}

export function parseXApiErrorDetail(body: string): string | undefined {
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

function readEndpointNeedsUserToken(detail: string | undefined): boolean {
  if (!detail) return false;

  const normalized = detail.toLowerCase();
  return (
    normalized.includes('application-only is forbidden') ||
    normalized.includes('oauth 2.0 application-only') ||
    normalized.includes('app-only') ||
    normalized.includes('user context')
  );
}

export function toReadAuthError(
  operation: string,
  error: unknown,
): { code: string; message: string } | undefined {
  if (error instanceof HttpError && (error.status === 401 || error.status === 403)) {
    const detail = parseXApiErrorDetail(error.body);
    const requiresUserToken = readEndpointNeedsUserToken(detail);

    return {
      code: 'INSUFFICIENT_READ_AUTH',
      message: [
        'Insufficient auth for read endpoint:',
        `- operation: ${operation}`,
        `- status: ${error.status} ${error.statusText}`,
        requiresUserToken
          ? '- required auth: X_ACCESS_TOKEN (OAuth 2.0 user token required for this endpoint)'
          : '- required auth: X_ACCESS_TOKEN or X_BEARER_TOKEN (with required read scopes)',
        ...(detail ? [`- x_api_detail: ${detail}`] : []),
      ].join('\n'),
    };
  }

  return undefined;
}

export function toWriteAuthError(
  operation: string,
  error: unknown,
): { code: string; message: string } | undefined {
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

export function toXApiHttpError(
  operation: string,
  error: unknown,
): { code: string; message: string } | undefined {
  if (!(error instanceof HttpError)) {
    return undefined;
  }

  const detail = parseXApiErrorDetail(error.body);

  return {
    code: 'X_API_REQUEST_FAILED',
    message: [
      'X API request failed:',
      `- operation: ${operation}`,
      `- status: ${error.status} ${error.statusText}`,
      ...(detail ? [`- x_api_detail: ${detail}`] : []),
    ].join('\n'),
  };
}

export function toXApiCommandError(
  operation: string,
  error: unknown,
  authScope: XApiAuthScope = 'read',
): { code: string; message: string } | undefined {
  const authError =
    authScope === 'write' ? toWriteAuthError(operation, error) : toReadAuthError(operation, error);

  if (authError) {
    return authError;
  }

  return toXApiHttpError(operation, error);
}
