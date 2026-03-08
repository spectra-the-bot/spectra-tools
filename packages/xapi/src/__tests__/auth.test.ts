import { HttpError } from '@spectratools/cli-shared';
import { describe, expect, it } from 'vitest';
import {
  readAuthToken,
  toWriteAuthError,
  writeAuthToken,
  xApiReadEnv,
  xApiWriteEnv,
} from '../auth.js';

describe('xapi auth token resolution', () => {
  it('prefers X_ACCESS_TOKEN for read operations when present', () => {
    const env = xApiReadEnv.parse({
      X_ACCESS_TOKEN: 'user-token',
      X_BEARER_TOKEN: 'app-token',
    });

    expect(readAuthToken(env)).toBe('user-token');
  });

  it('falls back to X_BEARER_TOKEN for read operations', () => {
    const env = xApiReadEnv.parse({ X_BEARER_TOKEN: 'app-token' });

    expect(readAuthToken(env)).toBe('app-token');
  });

  it('requires one read token in env schema', () => {
    expect(() => xApiReadEnv.parse({})).toThrowError(
      'Set X_ACCESS_TOKEN or X_BEARER_TOKEN to authenticate X API requests.',
    );
  });

  it('requires X_ACCESS_TOKEN for write operations', () => {
    expect(() => xApiWriteEnv.parse({})).toThrowError();
    const env = xApiWriteEnv.parse({ X_ACCESS_TOKEN: 'user-token' });
    expect(writeAuthToken(env)).toBe('user-token');
  });
});

describe('toWriteAuthError', () => {
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
