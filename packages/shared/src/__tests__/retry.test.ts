import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../middleware/retry.js';

describe('withRetry', () => {
  it('returns immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 3, baseMs: 10, maxMs: 100 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error('transient');
      return 'success';
    });

    vi.useFakeTimers();
    const promise = withRetry(fn, { maxRetries: 3, baseMs: 1, maxMs: 10 });
    // Advance timers to allow retries
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws after maxRetries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    vi.useFakeTimers();
    const promise = withRetry(fn, { maxRetries: 2, baseMs: 1, maxMs: 10 });
    const assertion = expect(promise).rejects.toThrow('always fails');
    await vi.runAllTimersAsync();
    await assertion;
    vi.useRealTimers();

    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('does not retry with maxRetries=0', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(withRetry(fn, { maxRetries: 0, baseMs: 10, maxMs: 100 })).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
