import { describe, expect, it, vi } from 'vitest';
import { createRateLimiter } from '../middleware/rate-limit.js';

describe('createRateLimiter', () => {
  it('allows immediate execution when tokens are available', async () => {
    const acquire = createRateLimiter({ requestsPerSecond: 10 });
    const start = Date.now();
    await acquire();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });

  it('allows up to requestsPerSecond requests immediately', async () => {
    const acquire = createRateLimiter({ requestsPerSecond: 5 });
    const promises = Array.from({ length: 5 }, () => acquire());
    const results = await Promise.all(promises);
    expect(results).toHaveLength(5);
  });

  it('queues requests beyond the rate limit', async () => {
    vi.useFakeTimers();
    const acquire = createRateLimiter({ requestsPerSecond: 2 });

    // Use first 2 tokens immediately
    await acquire();
    await acquire();

    // Third should be queued
    let resolved = false;
    const p = acquire().then(() => {
      resolved = true;
    });

    // Not resolved yet
    expect(resolved).toBe(false);

    // Advance time to allow refill
    await vi.advanceTimersByTimeAsync(600);
    await p;
    expect(resolved).toBe(true);

    vi.useRealTimers();
  });
});
