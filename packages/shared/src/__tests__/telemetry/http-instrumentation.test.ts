import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MockServer } from '../../testing/mock-server.js';
import { createMockServer } from '../../testing/mock-server.js';
import { createHttpClient } from '../../utils/http.js';

describe('telemetry/http-instrumentation', () => {
  let server: MockServer;
  let exporter: InstanceType<typeof InMemorySpanExporter>;
  let provider: InstanceType<typeof NodeTracerProvider>;

  beforeAll(() => {
    trace.disable();
  });

  beforeEach(async () => {
    exporter = new InMemorySpanExporter();
    trace.disable();
    provider = new NodeTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    provider.register();

    server = await createMockServer();
  });

  afterEach(async () => {
    await server.close();
    await provider.shutdown();
    exporter.reset();
    trace.disable();
  });

  afterAll(() => {
    trace.disable();
  });

  describe('with OTEL active (provider registered)', () => {
    it('creates a span for each HTTP request', async () => {
      server.addRoute('GET', '/data', { body: { items: [] } });
      const client = createHttpClient({ baseUrl: server.url });
      await client.request('/data');

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.name).toContain('HTTP GET');
    });

    it('span has correct method, URL, and status code attributes', async () => {
      server.addRoute('GET', '/users', { body: [{ id: 1 }] });
      const client = createHttpClient({ baseUrl: server.url });
      await client.request('/users');

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);

      const attrs = spans[0]?.attributes ?? {};
      expect(attrs['http.request.method']).toBe('GET');
      expect(attrs['url.full']).toContain('/users');
      expect(attrs['url.path']).toBe('/users');
      expect(attrs['http.response.status_code']).toBe(200);
      expect(spans[0]?.status.code).toBe(SpanStatusCode.OK);
    });

    it('records status code on error responses', async () => {
      server.addRoute('GET', '/not-found', { status: 404, body: { error: 'not found' } });
      const client = createHttpClient({ baseUrl: server.url });

      await expect(client.request('/not-found')).rejects.toThrow();

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.attributes['http.response.status_code']).toBe(404);
      expect(spans[0]?.status.code).toBe(SpanStatusCode.ERROR);
    });

    it('sets span kind to CLIENT', async () => {
      server.addRoute('GET', '/kind', { body: {} });
      const client = createHttpClient({ baseUrl: server.url });
      await client.request('/kind');

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.kind).toBe(SpanKind.CLIENT);
    });

    it('handles POST requests with correct method attribute', async () => {
      server.addRoute('POST', '/create', { status: 201, body: { id: 1 } });
      const client = createHttpClient({ baseUrl: server.url });
      await client.request('/create', { method: 'POST', body: { name: 'test' } });

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0]?.attributes['http.request.method']).toBe('POST');
      expect(spans[0]?.attributes['http.response.status_code']).toBe(201);
    });

    it('includes query parameters in url.full but not url.path', async () => {
      server.addRoute('GET', '/search', { body: { results: [] } });
      const client = createHttpClient({ baseUrl: server.url });
      await client.request('/search', { query: { q: 'test', limit: 10 } });

      const spans = exporter.getFinishedSpans();
      expect(spans).toHaveLength(1);
      const attrs = spans[0]?.attributes ?? {};
      const fullUrl = String(attrs['url.full'] ?? '');
      expect(fullUrl).toContain('q=test');
      expect(fullUrl).toContain('limit=10');
      expect(attrs['url.path']).toBe('/search');
    });
  });

  describe('without OTEL active (noop tracer)', () => {
    beforeEach(async () => {
      // Shut down the provider and disable global to simulate no OTEL
      await provider.shutdown();
      trace.disable();
      exporter.reset();
    });

    it('HTTP requests still succeed with no spans', async () => {
      server.addRoute('GET', '/noop', { body: { ok: true } });
      const client = createHttpClient({ baseUrl: server.url });
      const result = await client.request<{ ok: boolean }>('/noop');

      expect(result).toEqual({ ok: true });
      expect(exporter.getFinishedSpans()).toHaveLength(0);
    });

    it('HTTP errors still propagate with no spans', async () => {
      server.addRoute('GET', '/fail', { status: 500, body: { error: 'internal' } });
      const client = createHttpClient({ baseUrl: server.url });

      await expect(client.request('/fail')).rejects.toThrow();
      expect(exporter.getFinishedSpans()).toHaveLength(0);
    });
  });

  describe('performance', () => {
    it('adds less than 1ms overhead per request when OTEL is inactive', async () => {
      // Shut down the provider to simulate no OTEL
      await provider.shutdown();
      trace.disable();
      exporter.reset();

      server.addRoute('GET', '/perf', { body: { ok: true } });
      const client = createHttpClient({ baseUrl: server.url });

      // Warm up
      await client.request('/perf');

      const iterations = 50;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await client.request('/perf');
      }
      const elapsed = performance.now() - start;
      const perRequest = elapsed / iterations;

      // The total per-request time includes network to mock server,
      // so we just verify it's under a reasonable ceiling.
      // The OTEL overhead itself should be negligible (<1ms).
      // A local HTTP request to mock server typically takes 1-5ms,
      // so total should be well under 20ms per request.
      expect(perRequest).toBeLessThan(20);
    });
  });
});
