export interface RetryPolicy {
  maxRetries: number;
  baseMs: number;
  maxMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseMs: 500,
  maxMs: 4_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<{ value: T; attempts: number }> {
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= policy.maxRetries) {
    try {
      const value = await operation();
      return { value, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (attempt >= policy.maxRetries) {
        break;
      }

      const backoff = Math.min(policy.baseMs * 2 ** attempt, policy.maxMs);
      const jitter = Math.floor(Math.random() * 125);
      await sleep(backoff + jitter);
      attempt += 1;
    }
  }

  throw lastError;
}
