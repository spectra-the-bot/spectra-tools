import { type Span, SpanStatusCode, context, trace } from '@opentelemetry/api';

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
