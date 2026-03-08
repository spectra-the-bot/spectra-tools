import {
  createHttpClient,
  createRateLimiter,
  withRateLimit,
  withRetry,
} from '@spectratools/cli-shared';
import { z } from 'incur';

const DEFAULT_BASE_URL = 'https://api.etherscan.io/v2/api';
const RETRY_OPTIONS = { maxRetries: 3, baseMs: 500, maxMs: 10000 };

export type EtherscanParams = Record<string, string | number | boolean | undefined | null>;

const etherscanResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: z.unknown(),
});

const proxyResponseSchema = z.object({
  jsonrpc: z.string(),
  id: z.union([z.number(), z.string()]),
  result: z.unknown(),
});

export interface EtherscanValidationDebug {
  mode: 'rest' | 'proxy';
  params: EtherscanParams;
  issues: z.ZodIssue[];
  response: unknown;
}

export class EtherscanError extends Error {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'EtherscanError';
  }
}

export class EtherscanValidationError extends EtherscanError {
  constructor(public readonly debug: EtherscanValidationDebug) {
    super('Etherscan response validation failed', {
      code: 'INVALID_API_RESPONSE',
      mode: debug.mode,
      params: debug.params,
      issues: debug.issues,
      response: debug.response,
    });
    this.name = 'EtherscanValidationError';
  }
}

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  data: unknown,
  mode: EtherscanValidationDebug['mode'],
  params: EtherscanParams,
): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;

  throw new EtherscanValidationError({
    mode,
    params,
    issues: parsed.error.issues,
    response: data,
  });
}

export function createEtherscanClient(apiKey: string, baseUrl = DEFAULT_BASE_URL) {
  const http = createHttpClient({ baseUrl });
  const acquire = createRateLimiter({ requestsPerSecond: 5 });

  function request(params: EtherscanParams): Promise<unknown> {
    return withRetry(
      () =>
        withRateLimit(
          () =>
            http.request<unknown>('', {
              query: { ...params, apikey: apiKey },
            }),
          acquire,
        ),
      RETRY_OPTIONS,
    );
  }

  async function call<T>(params: EtherscanParams, resultSchema: z.ZodType<T>): Promise<T> {
    const rawResponse = await request(params);
    const response = parseWithSchema(etherscanResponseSchema, rawResponse, 'rest', params);

    if (response.status === '0') {
      const msg = typeof response.result === 'string' ? response.result : response.message;
      throw new EtherscanError(msg, {
        code: 'ETHERSCAN_API_ERROR',
        params,
        response,
      });
    }

    return parseWithSchema(resultSchema, response.result, 'rest', params);
  }

  async function callProxy<T>(params: EtherscanParams, resultSchema: z.ZodType<T>): Promise<T> {
    const rawResponse = await request(params);
    const response = parseWithSchema(proxyResponseSchema, rawResponse, 'proxy', params);
    return parseWithSchema(resultSchema, response.result, 'proxy', params);
  }

  return { call, callProxy };
}
