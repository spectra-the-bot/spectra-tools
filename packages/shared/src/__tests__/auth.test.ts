import { describe, expect, it } from 'vitest';
import { MissingApiKeyError, apiKeyAuth } from '../middleware/auth.js';

describe('apiKeyAuth', () => {
  it('reads and returns the configured API key from env', () => {
    process.env.SPECTRA_TEST_API_KEY = 'test-key-123';

    const result = apiKeyAuth('SPECTRA_TEST_API_KEY');

    expect(result).toEqual({ apiKey: 'test-key-123' });

    delete process.env.SPECTRA_TEST_API_KEY;
  });

  it('throws MissingApiKeyError when the env var is missing', () => {
    delete process.env.SPECTRA_MISSING_API_KEY;

    expect(() => apiKeyAuth('SPECTRA_MISSING_API_KEY')).toThrow(MissingApiKeyError);
  });

  it('includes the missing env var name in the error message', () => {
    const envVar = 'SPECTRA_REQUIRED_API_KEY';
    delete process.env[envVar];

    try {
      apiKeyAuth(envVar);
      throw new Error('Expected apiKeyAuth to throw MissingApiKeyError');
    } catch (error) {
      expect(error).toBeInstanceOf(MissingApiKeyError);
      expect((error as MissingApiKeyError).message).toContain(envVar);
    }
  });
});
