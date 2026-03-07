export interface HttpClientOptions {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly headers: Headers = new Headers(),
  ) {
    super(`HTTP ${status} ${statusText}: ${body}`);
    this.name = 'HttpError';
  }
}

function serializeQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * Typed fetch wrapper with base URL, default headers, query serialization, and error handling.
 */
export function createHttpClient(options: HttpClientOptions) {
  const { baseUrl, defaultHeaders = {} } = options;

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = 'GET', headers = {}, query = {}, body } = opts;

    const qs = serializeQuery(query);
    const url = `${baseUrl}${path}${qs}`;

    const init: RequestInit = {
      method,
    };

    const mergedHeaders: Record<string, string> = {
      ...defaultHeaders,
      ...headers,
    };

    if (body !== undefined) {
      mergedHeaders['Content-Type'] ??= 'application/json';
      init.body = JSON.stringify(body);
    }

    init.headers = mergedHeaders;

    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text();
      throw new HttpError(res.status, res.statusText, text, res.headers);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return res.json() as Promise<T>;
    }

    return res.text() as unknown as Promise<T>;
  }

  return { request };
}
