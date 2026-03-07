export interface RetryOptions {
  maxRetries: number;
  baseMs: number;
  maxMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return ms * (0.5 + Math.random() * 0.5);
}

function parseRetryAfter(headers: Headers): number | null {
  const retryAfter = headers.get('Retry-After');
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds)) return seconds * 1000;

  const date = Date.parse(retryAfter);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());

  return null;
}

/**
 * Wraps a fetch-like function with exponential backoff retry logic.
 * Respects Retry-After headers on 429/503 responses.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxRetries, baseMs, maxMs } = options;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries) throw err;

      let delayMs: number;

      if (err instanceof Response && (err.status === 429 || err.status === 503)) {
        const retryAfterMs = parseRetryAfter(err.headers);
        delayMs = retryAfterMs ?? Math.min(baseMs * 2 ** attempt, maxMs);
      } else {
        delayMs = Math.min(baseMs * 2 ** attempt, maxMs);
      }

      await sleep(jitter(delayMs));
      attempt++;
    }
  }
}
