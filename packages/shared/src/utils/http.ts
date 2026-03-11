import { context } from '@opentelemetry/api';
import { createHttpSpan, endHttpSpan, endHttpSpanWithError } from '../telemetry/spans.js';

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
 * Automatically creates OpenTelemetry spans for each request when OTEL is active.
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

    const { span, ctx } = createHttpSpan(method, url);

    try {
      const res = await context.with(ctx, () => fetch(url, init));

      if (!res.ok) {
        const text = await res.text();
        const err = new HttpError(res.status, res.statusText, text, res.headers);
        endHttpSpanWithError(span, err, res.status);
        throw err;
      }

      const contentLength = res.headers.get('content-length');
      const contentType = res.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const data = (await res.json()) as T;
        endHttpSpan(span, res.status, contentLength ? Number(contentLength) : undefined);
        return data;
      }

      const text = (await res.text()) as unknown as T;
      endHttpSpan(span, res.status, contentLength ? Number(contentLength) : undefined);
      return text;
    } catch (err) {
      if (!(err instanceof HttpError)) {
        // Network or other non-HTTP error
        endHttpSpanWithError(span, err);
      }
      throw err;
    }
  }

  return { request };
}
