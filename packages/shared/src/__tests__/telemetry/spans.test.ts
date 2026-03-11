import { SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCommandSpan,
  createHttpSpan,
  endHttpSpan,
  endHttpSpanWithError,
  extractPath,
  recordError,
  sanitizeAttributes,
  withCommandSpan,
  withSpan,
} from '../../telemetry/spans.js';

describe('telemetry/spans', () => {
  let exporter: InstanceType<typeof InMemorySpanExporter>;
  let provider: InstanceType<typeof NodeTracerProvider>;

  beforeAll(() => {
    // Reset any globally registered provider from other test files
    trace.disable();
  });

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    // Reset global state before registering our provider
    trace.disable();
    provider.register();
  });

  afterEach(async () => {
    await provider.shutdown();
    exporter.reset();
    trace.disable();
  });

  afterAll(() => {
    trace.disable();
  });

  describe('sanitizeAttributes', () => {
    it('strips keys containing sensitive patterns', () => {
      const result = sanitizeAttributes({
        address: '0x1234',
        private_key: '0xdeadbeef',
        password: 'hunter2',
        api_key: 'sk-secret',
        auth_header: 'Bearer xyz',
        secret_value: 'shh',
        mnemonic: 'word word word',
        seed_phrase: 'word word',
        normal_flag: true,
      });

      expect(result).toHaveProperty('address', '0x1234');
      expect(result).toHaveProperty('normal_flag', true);
      expect(result).not.toHaveProperty('private_key');
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('api_key');
      expect(result).not.toHaveProperty('auth_header');
      expect(result).not.toHaveProperty('secret_value');
      expect(result).not.toHaveProperty('mnemonic');
      expect(result).not.toHaveProperty('seed_phrase');
    });

    it('strips values containing sensitive patterns', () => {
      const result = sanitizeAttributes({
        header: 'my-api-key-value',
        config: 'contains password inside',
      });

      expect(result).not.toHaveProperty('header');
      expect(result).not.toHaveProperty('config');
    });

    it('converts non-primitive values to strings', () => {
      const result = sanitizeAttributes({
        count: 42,
        enabled: false,
        obj: { nested: true },
      });

      expect(result).toEqual({
        count: 42,
        enabled: false,
        obj: '[object Object]',
      });
    });

    it('skips undefined and null values', () => {
      const result = sanitizeAttributes({
        a: undefined,
        b: null,
        c: 'valid',
      });

      expect(result).toEqual({ c: 'valid' });
    });
  });

  describe('createCommandSpan', () => {
    it('creates a span with the correct name', () => {
      const span = createCommandSpan('account balance');
      span.end();

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe('cli.command.account balance');
    });

    it('attaches sanitized args as attributes', () => {
      const span = createCommandSpan('test-cmd', {
        address: '0xabc',
        format: 'json',
        private_key: 'should-be-stripped',
      });
      span.end();

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);

      const attrs = spans[0]?.attributes ?? {};
      expect(attrs['cli.arg.address']).toBe('0xabc');
      expect(attrs['cli.arg.format']).toBe('json');
      expect(attrs['cli.arg.private_key']).toBeUndefined();
    });

    it('creates a span without args', () => {
      const span = createCommandSpan('simple');
      span.end();

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe('cli.command.simple');
    });
  });

  describe('withCommandSpan', () => {
    it('creates a span, executes fn, and returns the result', async () => {
      const result = await withCommandSpan('test-cmd', { flag: 'value' }, async () => {
        return 42;
      });

      expect(result).toBe(42);

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe('cli.command.test-cmd');
      expect(spans[0]?.status.code).toBe(SpanStatusCode.OK);
    });

    it('records errors and re-throws on failure', async () => {
      await expect(
        withCommandSpan('failing-cmd', {}, async () => {
          throw new Error('command failed');
        }),
      ).rejects.toThrow('command failed');

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expect(spans[0]?.status.message).toBe('command failed');
      expect(spans[0]?.events).toHaveLength(1);
      expect(spans[0]?.events[0]?.name).toBe('exception');
    });
  });

  describe('withSpan', () => {
    it('creates a child span, executes fn, and returns the result', async () => {
      const result = await withSpan('child-op', async (span) => {
        expect(span).toBeDefined();
        return 'done';
      });

      expect(result).toBe('done');

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe('child-op');
      expect(spans[0]?.status.code).toBe(SpanStatusCode.OK);
    });

    it('records errors and re-throws on failure', async () => {
      await expect(
        withSpan('failing-span', async () => {
          throw new Error('span failed');
        }),
      ).rejects.toThrow('span failed');

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expect(spans[0]?.status.message).toBe('span failed');
    });

    it('propagates span context to child operations', async () => {
      await withSpan('parent', async () => {
        // Create a child span within the parent context
        const tracer = trace.getTracer('@spectratools/cli-shared');
        const child = tracer.startSpan('child-of-parent');
        child.end();
      });

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(2);

      const parent = spans.find((s) => s.name === 'parent');
      const child = spans.find((s) => s.name === 'child-of-parent');
      expect(parent).toBeDefined();
      expect(child).toBeDefined();

      // Child should have parent's span as parent context
      // In OTEL SDK v2, parent info is stored in parentSpanContext
      if (parent && child) {
        expect(child.parentSpanContext?.spanId).toBe(parent.spanContext().spanId);
      }
    });
  });

  describe('recordError', () => {
    it('sets error status and records an Error exception', () => {
      const span = createCommandSpan('test');
      const err = new Error('something broke');
      recordError(span, err);
      span.end();

      const spans = exporter.getFinishedSpans();
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expect(spans[0]?.status.message).toBe('something broke');
      expect(spans[0]?.events).toHaveLength(1);
      expect(spans[0]?.events[0]?.name).toBe('exception');
    });

    it('handles non-Error values by wrapping them', () => {
      const span = createCommandSpan('test');
      recordError(span, 'string error');
      span.end();

      const spans = exporter.getFinishedSpans();
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expect(spans[0]?.status.message).toBe('string error');
    });

    it('handles object error values', () => {
      const span = createCommandSpan('test');
      recordError(span, { code: 'FAIL', detail: 'bad request' });
      span.end();

      const spans = exporter.getFinishedSpans();
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
    });
  });

  describe('extractPath', () => {
    it('extracts pathname from a valid URL', () => {
      expect(extractPath('https://api.example.com/v1/data?q=test')).toBe('/v1/data');
    });

    it('strips query params from a non-URL string', () => {
      expect(extractPath('/api/data?q=test')).toBe('/api/data');
    });

    it('returns the string as-is when no query params', () => {
      expect(extractPath('/api/data')).toBe('/api/data');
    });
  });

  describe('createHttpSpan + endHttpSpan', () => {
    it('creates a span with correct HTTP attributes', () => {
      const { span } = createHttpSpan('GET', 'https://api.example.com/v1/data');
      endHttpSpan(span, 200, 1234);

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toBe('HTTP GET /v1/data');

      const attrs = spans[0]?.attributes ?? {};
      expect(attrs['http.request.method']).toBe('GET');
      expect(attrs['url.full']).toBe('https://api.example.com/v1/data');
      expect(attrs['url.path']).toBe('/v1/data');
      expect(attrs['http.response.status_code']).toBe(200);
      expect(attrs['http.response_content_length']).toBe(1234);
      expect(spans[0]?.status.code).toBe(SpanStatusCode.OK);
    });
  });

  describe('endHttpSpanWithError', () => {
    it('records error with status code', () => {
      const { span } = createHttpSpan('POST', 'https://api.example.com/v1/create');
      endHttpSpanWithError(span, new Error('server error'), 500);

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expect(spans[0]?.attributes['http.response.status_code']).toBe(500);
    });

    it('records error without status code', () => {
      const { span } = createHttpSpan('GET', 'https://api.example.com/timeout');
      endHttpSpanWithError(span, new Error('timeout'));

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
      expect(spans[0]?.attributes['http.response.status_code']).toBeUndefined();
    });
  });
});
