import {
  HttpError,
  createHttpClient,
  createRateLimiter,
  withRateLimit,
} from '@spectratools/cli-shared';
import { Errors } from 'incur';

const DEFAULT_BASE_URL = 'https://pro-openapi.debank.com';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 10000;

export type DebankParams = Record<string, string | number | boolean | undefined | null>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Transient failures worth retrying: network errors, 429, and 5xx. */
function isRetryable(err: unknown): boolean {
  if (err instanceof HttpError) {
    return err.status === 429 || err.status >= 500;
  }
  // Non-HTTP errors are network/transport failures.
  return true;
}

/** Convert any thrown error into an incur IncurError so the CLI surfaces a code. */
function toIncurError(err: unknown, path: string, _params: DebankParams): Errors.IncurError {
  if (err instanceof HttpError) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(err.body);
    } catch {
      parsed = err.body;
    }
    const detail =
      parsed && typeof parsed === 'object' && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : err.body || err.statusText;
    return new Errors.IncurError({
      code: 'DEBANK_API_ERROR',
      message: `DeBank API error (HTTP ${err.status}) on ${path}${detail ? `: ${detail}` : ''}`,
      retryable: isRetryable(err),
      hint:
        err.status === 401 || err.status === 403
          ? 'Check that ACCESS_KEY is a valid DeBank Pro API key.'
          : undefined,
      cause: err,
    });
  }
  return new Errors.IncurError({
    code: 'DEBANK_REQUEST_FAILED',
    message: `Request to ${path} failed: ${err instanceof Error ? err.message : String(err)}`,
    retryable: true,
    cause: err instanceof Error ? err : undefined,
  });
}

/**
 * Client for the DeBank Pro OpenAPI.
 *
 * Auth: an `AccessKey` request header (NOT a query param). The DeBank API
 * returns result payloads directly as JSON (object or array) on success and a
 * non-2xx status with an error body on failure, surfaced by the shared HTTP
 * client as an {@link HttpError}. We retry transient failures (429/5xx/network)
 * with exponential backoff and convert terminal failures into an `IncurError`
 * carrying a machine-readable `code`.
 */
export function createDebankClient(accessKey: string, baseUrl = DEFAULT_BASE_URL) {
  const http = createHttpClient({
    baseUrl,
    defaultHeaders: {
      Accept: 'application/json',
      AccessKey: accessKey,
    },
  });
  // DeBank Pro rate limits per access key; stay conservative by default.
  const acquire = createRateLimiter({ requestsPerSecond: 5 });

  async function execute<T>(path: string, params: DebankParams, fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await withRateLimit(fn, acquire);
      } catch (err) {
        if (attempt >= MAX_RETRIES || !isRetryable(err)) {
          throw toIncurError(err, path, params);
        }
        const delay = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
        attempt += 1;
        await sleep(delay * (0.5 + Math.random() * 0.5));
      }
    }
  }

  function get<T>(path: string, params: DebankParams = {}): Promise<T> {
    return execute(path, params, () => http.request<T>(path, { method: 'GET', query: params }));
  }

  function post<T>(path: string, body: unknown): Promise<T> {
    return execute(path, {}, () => http.request<T>(path, { method: 'POST', body }));
  }

  return { get, post };
}
