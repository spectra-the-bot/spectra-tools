import { HttpError } from '@spectratools/cli-shared';
import { describe, expect, it } from 'vitest';
import {
  readAuthToken,
  toReadAuthError,
  toWriteAuthError,
  toXApiCommandError,
  toXApiHttpError,
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

describe('toReadAuthError', () => {
  it('maps 403 responses to insufficient read auth and user-token requirement', () => {
    const err = new HttpError(
      403,
      'Forbidden',
      JSON.stringify({ detail: 'Authenticating with OAuth 2.0 Application-Only is forbidden' }),
    );

    const mapped = toReadAuthError('users search', err);

    expect(mapped?.code).toBe('INSUFFICIENT_READ_AUTH');
    expect(mapped?.message).toContain('operation: users search');
    expect(mapped?.message).toContain(
      'X_ACCESS_TOKEN (OAuth 2.0 user token required for this endpoint)',
    );
    expect(mapped?.message).toContain(
      'x_api_detail: Authenticating with OAuth 2.0 Application-Only is forbidden',
    );
  });

  it('returns undefined for non-auth errors', () => {
    const err = new HttpError(400, 'Bad Request', '{"detail":"oops"}');
    expect(toReadAuthError('posts search', err)).toBeUndefined();
  });
});

describe('toXApiHttpError', () => {
  it('parses X API detail from error body', () => {
    const err = new HttpError(
      400,
      'Bad Request',
      JSON.stringify({
        errors: [
          { message: 'The `max_results` query parameter value [3] is not between 10 and 100' },
        ],
      }),
    );

    const mapped = toXApiHttpError('posts search', err);

    expect(mapped?.code).toBe('X_API_REQUEST_FAILED');
    expect(mapped?.message).toContain('operation: posts search');
    expect(mapped?.message).toContain('status: 400 Bad Request');
    expect(mapped?.message).toContain(
      'x_api_detail: The `max_results` query parameter value [3] is not between 10 and 100',
    );
  });
});

describe('toXApiCommandError', () => {
  it('prefers auth mapping before general HTTP mapping', () => {
    const err = new HttpError(
      403,
      'Forbidden',
      JSON.stringify({ detail: 'Authenticating with OAuth 2.0 Application-Only is forbidden' }),
    );

    const mapped = toXApiCommandError('users search', err, 'read');

    expect(mapped?.code).toBe('INSUFFICIENT_READ_AUTH');
  });
});
