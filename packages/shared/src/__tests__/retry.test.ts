import { describe, expect, it, vi } from 'vitest';
import { withRetry } from '../middleware/retry.js';
import { HttpError } from '../utils/http.js';

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

  it('respects Retry-After header for 429 HttpError', async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1);

    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        throw new HttpError(
          429,
          'Too Many Requests',
          'rate limited',
          new Headers({ 'Retry-After': '2' }),
        );
      }
      return 'ok';
    });

    try {
      const promise = withRetry(fn, { maxRetries: 2, baseMs: 1, maxMs: 10 });

      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1999);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(promise).resolves.toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    } finally {
      randomSpy.mockRestore();
      vi.useRealTimers();
    }
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
