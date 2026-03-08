import { HttpError, MissingApiKeyError } from '@spectratools/cli-shared';
import { afterEach, describe, expect, it } from 'vitest';
import { readAuthToken, toWriteAuthError, writeAuthToken } from '../auth.js';

const ORIGINAL_ENV = {
  X_BEARER_TOKEN: process.env.X_BEARER_TOKEN,
  X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN,
};

afterEach(() => {
  if (ORIGINAL_ENV.X_BEARER_TOKEN === undefined) {
    Reflect.deleteProperty(process.env, 'X_BEARER_TOKEN');
  } else {
    process.env.X_BEARER_TOKEN = ORIGINAL_ENV.X_BEARER_TOKEN;
  }

  if (ORIGINAL_ENV.X_ACCESS_TOKEN === undefined) {
    Reflect.deleteProperty(process.env, 'X_ACCESS_TOKEN');
  } else {
    process.env.X_ACCESS_TOKEN = ORIGINAL_ENV.X_ACCESS_TOKEN;
  }
});

describe('xapi auth token resolution', () => {
  it('prefers X_ACCESS_TOKEN for read operations when present', () => {
    process.env.X_ACCESS_TOKEN = 'user-token';
    process.env.X_BEARER_TOKEN = 'app-token';

    expect(readAuthToken()).toBe('user-token');
  });

  it('falls back to X_BEARER_TOKEN for read operations', () => {
    Reflect.deleteProperty(process.env, 'X_ACCESS_TOKEN');
    process.env.X_BEARER_TOKEN = 'app-token';

    expect(readAuthToken()).toBe('app-token');
  });

  it('requires X_ACCESS_TOKEN for write operations', () => {
    Reflect.deleteProperty(process.env, 'X_ACCESS_TOKEN');

    expect(() => writeAuthToken()).toThrow(MissingApiKeyError);
  });
});

describe('toWriteAuthError', () => {
  it('maps missing access token to a structured write auth error', () => {
    const mapped = toWriteAuthError('posts create', new MissingApiKeyError('X_ACCESS_TOKEN'));

    expect(mapped).toEqual({
      code: 'WRITE_AUTH_REQUIRED',
      message: expect.stringContaining('set env var: X_ACCESS_TOKEN'),
    });
    expect(mapped?.message).toContain('operation: posts create');
  });

  it('maps 403 responses to insufficient auth error with API detail', () => {
    const err = new HttpError(
      403,
      'Forbidden',
      JSON.stringify({ detail: 'Unsupported Authentication' }),
    );
    const mapped = toWriteAuthError('dm send', err);

    expect(mapped?.code).toBe('INSUFFICIENT_WRITE_AUTH');
    expect(mapped?.message).toContain('operation: dm send');
    expect(mapped?.message).toContain('status: 403 Forbidden');
    expect(mapped?.message).toContain('x_api_detail: Unsupported Authentication');
  });

  it('returns undefined for non-auth errors', () => {
    const err = new HttpError(500, 'Internal Server Error', '{"detail":"oops"}');
    expect(toWriteAuthError('posts delete', err)).toBeUndefined();
  });
});
