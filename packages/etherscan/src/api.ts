import { createHttpClient } from '@spectra-the-bot/cli-shared';

const DEFAULT_BASE_URL = 'https://api.etherscan.io/v2/api';

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

  async function call<T>(params: EtherscanParams): Promise<T> {
    const response = await http.request<EtherscanResponse<T>>('', {
      query: { ...params, apikey: apiKey },
    });
    if (response.status === '0') {
      const msg = typeof response.result === 'string' ? response.result : response.message;
      throw new EtherscanError(msg);
    }
    return response.result;
  }

  async function callProxy<T>(params: EtherscanParams): Promise<T> {
    const response = await http.request<ProxyResponse<T>>('', {
      query: { ...params, apikey: apiKey },
    });
    return response.result;
  }

  return { call, callProxy };
}
