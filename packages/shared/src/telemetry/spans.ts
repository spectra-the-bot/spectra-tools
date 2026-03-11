import { type Span, SpanKind, SpanStatusCode, context, trace } from '@opentelemetry/api';
import {
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
  ATTR_URL_PATH,
} from '@opentelemetry/semantic-conventions';

const TRACER_NAME = '@spectratools/cli-shared';

/** Patterns that indicate sensitive values which must not appear in span attributes. */
const SENSITIVE_PATTERNS = [
  /private[\s_-]?key/i,
  /secret/i,
  /password/i,
  /passphrase/i,
  /mnemonic/i,
  /seed/i,
  /token/i,
  /api[\s_-]?key/i,
  /auth/i,
];

/**
 * Sanitize a record of span attributes by stripping any key/value that looks
 * like it contains a private key, password, or other sensitive material.
 */
function sanitizeAttributes(
  attrs: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attrs)) {
    const strKey = key.toLowerCase();
    const strVal = typeof value === 'string' ? value : '';

    const isSensitive = SENSITIVE_PATTERNS.some(
      (p) => p.test(strKey) || (strVal.length > 0 && p.test(strVal)),
    );

    if (isSensitive) continue;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    } else if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }
  return result;
}

/**
 * Create a root span for a CLI command invocation.
 *
 * @param commandName - The command being executed (e.g. `"account balance"`).
 * @param args - Optional key-value arguments to attach as span attributes (sensitive values are stripped).
 * @returns A started `Span`. The caller is responsible for calling `span.end()`.
 */
export function createCommandSpan(commandName: string, args?: Record<string, unknown>): Span {
  const tracer = trace.getTracer(TRACER_NAME);
  const span = tracer.startSpan(`cli.command.${commandName}`);

  if (args) {
    const safe = sanitizeAttributes(args);
    for (const [k, v] of Object.entries(safe)) {
      span.setAttribute(`cli.arg.${k}`, v);
    }
  }

  return span;
}

/**
 * Convenience wrapper that creates a child span, runs the given async function,
 * and automatically ends the span. On error, the error is recorded on the span
 * before being re-thrown.
 *
 * @param name - Span name.
 * @param fn - Async function to execute within the span context.
 * @returns The result of `fn`.
 */
export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
  const tracer = trace.getTracer(TRACER_NAME);
  const span = tracer.startSpan(name);
  const ctx = trace.setSpan(context.active(), span);

  try {
    const result = await context.with(ctx, () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    recordError(span, err);
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Attach error details and stack trace to a span and mark it as errored.
 *
 * @param span - The span to annotate.
 * @param error - The error value (may be an `Error` instance or arbitrary value).
 */
export function recordError(span: Span, error: unknown): void {
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error instanceof Error ? error.message : String(error),
  });

  if (error instanceof Error) {
    span.recordException(error);
  } else {
    span.recordException(new Error(String(error)));
  }
}

/**
 * Extract the pathname from a URL string, stripping the base URL and query parameters.
 */
export function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    // If not a valid absolute URL, strip query params from the raw string
    const qIndex = url.indexOf('?');
    return qIndex >= 0 ? url.slice(0, qIndex) : url;
  }
}

/**
 * Create a child span for an HTTP client request.
 *
 * @param method - HTTP method (e.g. GET, POST).
 * @param url - Full request URL.
 * @returns An object with the started `span` and `ctx` for context propagation.
 */
export function createHttpSpan(
  method: string,
  url: string,
): { span: Span; ctx: ReturnType<typeof trace.setSpan> } {
  const tracer = trace.getTracer(TRACER_NAME);
  const path = extractPath(url);
  const span = tracer.startSpan(`HTTP ${method} ${path}`, {
    kind: SpanKind.CLIENT,
    attributes: {
      [ATTR_HTTP_REQUEST_METHOD]: method,
      [ATTR_URL_FULL]: url,
      [ATTR_URL_PATH]: path,
    },
  });
  const ctx = trace.setSpan(context.active(), span);
  return { span, ctx };
}

/**
 * Finalize an HTTP span with response details.
 */
export function endHttpSpan(span: Span, statusCode: number, contentLength?: number): void {
  span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, statusCode);
  if (contentLength !== undefined) {
    span.setAttribute('http.response_content_length', contentLength);
  }
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

/**
 * Finalize an HTTP span with an error.
 */
export function endHttpSpanWithError(span: Span, error: unknown, statusCode?: number): void {
  if (statusCode !== undefined) {
    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, statusCode);
  }
  recordError(span, error);
  span.end();
}
