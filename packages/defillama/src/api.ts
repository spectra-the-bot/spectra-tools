import {
  createHttpClient,
  createRateLimiter,
  withRateLimit,
  withRetry,
} from '@spectratools/cli-shared';

/** DefiLlama API hosts */
export const DEFILLAMA_HOSTS = {
  api: 'https://api.llama.fi',
  coins: 'https://coins.llama.fi',
  yields: 'https://yields.llama.fi',
  stablecoins: 'https://stablecoins.llama.fi',
  bridges: 'https://bridges.llama.fi',
} as const;

export type DefiLlamaHost = keyof typeof DEFILLAMA_HOSTS;

const RETRY_OPTIONS = { maxRetries: 3, baseMs: 500, maxMs: 10_000 };

export interface DefiLlamaClientOptions {
  /** Override base URLs for testing */
  hosts?: Partial<Record<DefiLlamaHost, string>>;
  /** Requests per second (default: 5) */
  requestsPerSecond?: number;
}

export interface DefiLlamaClient {
  /** GET request to a specific host + path, returning parsed JSON. */
  get<T>(host: DefiLlamaHost, path: string): Promise<T>;
}

/**
 * Create a DefiLlama API client with rate limiting and retry logic.
 * No authentication required — DefiLlama is a free, public API.
 */
export function createDefiLlamaClient(options: DefiLlamaClientOptions = {}): DefiLlamaClient {
  const { hosts = {}, requestsPerSecond = 5 } = options;

  const resolvedHosts: Record<DefiLlamaHost, string> = {
    api: hosts.api ?? DEFILLAMA_HOSTS.api,
    coins: hosts.coins ?? DEFILLAMA_HOSTS.coins,
    yields: hosts.yields ?? DEFILLAMA_HOSTS.yields,
    stablecoins: hosts.stablecoins ?? DEFILLAMA_HOSTS.stablecoins,
    bridges: hosts.bridges ?? DEFILLAMA_HOSTS.bridges,
  };

  const clients = Object.fromEntries(
    Object.entries(resolvedHosts).map(([key, baseUrl]) => [key, createHttpClient({ baseUrl })]),
  ) as Record<DefiLlamaHost, ReturnType<typeof createHttpClient>>;

  const acquire = createRateLimiter({ requestsPerSecond });

  function get<T>(host: DefiLlamaHost, path: string): Promise<T> {
    const http = clients[host];
    return withRetry(() => withRateLimit(() => http.request<T>(path), acquire), RETRY_OPTIONS);
  }

  return { get };
}
