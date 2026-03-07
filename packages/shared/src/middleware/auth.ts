export class MissingApiKeyError extends Error {
  constructor(envVar: string) {
    super(`Missing required API key. Set the ${envVar} environment variable.`);
    this.name = 'MissingApiKeyError';
  }
}

export interface ApiKeyAuthContext {
  apiKey: string;
}

/**
 * Reads an API key from the environment and returns it.
 * Throws MissingApiKeyError if the variable is not set.
 */
export function apiKeyAuth(envVar: string): ApiKeyAuthContext {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    throw new MissingApiKeyError(envVar);
  }
  return { apiKey };
}
