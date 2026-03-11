import { trace } from '@opentelemetry/api';

export interface RateLimitOptions {
  requestsPerSecond: number;
}

/**
 * Token bucket rate limiter. Returns a function that must be called
 * before each request; it resolves when the request is allowed.
 */
export function createRateLimiter(options: RateLimitOptions): () => Promise<void> {
  const { requestsPerSecond } = options;
  const intervalMs = 1000 / requestsPerSecond;
  const queue: Array<() => void> = [];
  let tokens = requestsPerSecond;
  let lastRefill = Date.now();
  let processingInterval: ReturnType<typeof setInterval> | null = null;

  function refill(): void {
    const now = Date.now();
    const elapsed = now - lastRefill;
    const newTokens = (elapsed / 1000) * requestsPerSecond;
    tokens = Math.min(requestsPerSecond, tokens + newTokens);
    lastRefill = now;
  }

  function processQueue(): void {
    refill();
    while (queue.length > 0 && tokens >= 1) {
      tokens -= 1;
      const resolve = queue.shift();
      resolve?.();
    }
    if (queue.length === 0 && processingInterval !== null) {
      clearInterval(processingInterval);
      processingInterval = null;
    }
  }

  return (): Promise<void> => {
    return new Promise((resolve) => {
      refill();
      if (tokens >= 1) {
        tokens -= 1;
        resolve();
        return;
      }

      queue.push(resolve);
      if (processingInterval === null) {
        processingInterval = setInterval(processQueue, intervalMs);
      }
    });
  };
}

/**
 * Wraps a fetch-like function with token bucket rate limiting.
 * Records wait time as a span attribute when OTEL is active.
 */
export function withRateLimit<T>(fn: () => Promise<T>, acquire: () => Promise<void>): Promise<T> {
  const start = Date.now();
  return acquire().then(() => {
    const waitMs = Date.now() - start;
    if (waitMs > 0) {
      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        activeSpan.setAttribute('rate_limit.wait_ms', waitMs);
      }
    }
    return fn();
  });
}
