import { createHttpClient, createRateLimiter, withRateLimit, withRetry } from '@spectra-the-bot/cli-shared';

const DEFAULT_BASE_URL = 'https://api.etherscan.io/v2/api';
const RETRY_OPTIONS = { maxRetries: 3, baseMs: 500, maxMs: 10000 };

export type EtherscanParams = Record<string, string | number | boolean | undefined | null>;

interface EtherscanResponse<T> {
  status: string;
  message: string;
  result: T;
}

interface ProxyResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
}

export class EtherscanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EtherscanError';
  }
}

export function createEtherscanClient(apiKey: string, baseUrl = DEFAULT_BASE_URL) {
  const http = createHttpClient({ baseUrl });
  const acquire = createRateLimiter({ requestsPerSecond: 5 });

  function request<T>(params: EtherscanParams): Promise<T> {
    return withRetry(
      () =>
        withRateLimit(
          () =>
            http.request<T>('', {
              query: { ...params, apikey: apiKey },
            }),
          acquire,
        ),
      RETRY_OPTIONS,
    );
  }

  async function call<T>(params: EtherscanParams): Promise<T> {
    const response = await request<EtherscanResponse<T>>(params);
    if (response.status === '0') {
      const msg = typeof response.result === 'string' ? response.result : response.message;
      throw new EtherscanError(msg);
    }
    return response.result;
  }

  async function callProxy<T>(params: EtherscanParams): Promise<T> {
    const response = await request<ProxyResponse<T>>(params);
    return response.result;
  }

  return { call, callProxy };
}
