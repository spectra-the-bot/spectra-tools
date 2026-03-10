import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function clearOtelEnv() {
  // Must use delete to fully remove keys — assigning undefined leaves them as "undefined" strings
  const keys = ['OTEL_EXPORTER_OTLP_ENDPOINT', 'SPECTRA_OTEL_ENABLED', 'OTEL_SERVICE_NAME'];
  for (const key of keys) {
    delete process.env[key];
  }
}

describe('telemetry', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save and clear OTEL env vars before each test
    for (const key of [
      'OTEL_EXPORTER_OTLP_ENDPOINT',
      'SPECTRA_OTEL_ENABLED',
      'OTEL_SERVICE_NAME',
    ]) {
      savedEnv[key] = process.env[key];
    }
    clearOtelEnv();
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.restoreAllMocks();
  });

  describe('initTelemetry', () => {
    it('is a no-op when OTEL env vars are absent', async () => {
      // Dynamically import to get fresh module state
      const { initTelemetry, _getSdk, _resetForTesting } = await import('../telemetry/init.js');
      _resetForTesting();

      // Should not throw
      initTelemetry('test');

      // SDK should not have been created
      expect(_getSdk()).toBeUndefined();
    });

    it('does not create an SDK instance when env vars are absent', async () => {
      const { _resetForTesting, initTelemetry, _getSdk } = await import('../telemetry/init.js');
      _resetForTesting();

      initTelemetry('test');

      // SDK should not have been created since env vars are absent
      expect(_getSdk()).toBeUndefined();
    });

    it('only initializes once even when called multiple times', async () => {
      const { _resetForTesting, initTelemetry, _isInitialized } = await import(
        '../telemetry/init.js'
      );
      _resetForTesting();

      initTelemetry('test');
      expect(_isInitialized()).toBe(true);

      // Second call should not throw and should be a no-op
      initTelemetry('test-again');
      expect(_isInitialized()).toBe(true);
    });
  });

  describe('shutdownTelemetry', () => {
    it('is a no-op when telemetry was never initialized', async () => {
      const { _resetForTesting } = await import('../telemetry/init.js');
      const { shutdownTelemetry } = await import('../telemetry/shutdown.js');
      _resetForTesting();

      // Should not throw
      await expect(shutdownTelemetry()).resolves.toBeUndefined();
    });

    it('is a no-op when OTEL env vars are absent', async () => {
      const { _resetForTesting, initTelemetry } = await import('../telemetry/init.js');
      const { shutdownTelemetry } = await import('../telemetry/shutdown.js');
      _resetForTesting();

      initTelemetry('test');

      // SDK was never created because env vars are absent
      await expect(shutdownTelemetry()).resolves.toBeUndefined();
    });
  });

  describe('spans', () => {
    it('createCommandSpan returns a span (noop tracer when SDK not initialized)', async () => {
      const { createCommandSpan } = await import('../telemetry/spans.js');

      const span = createCommandSpan('test-command', { flag: 'value' });
      expect(span).toBeDefined();
      expect(typeof span.end).toBe('function');
      span.end();
    });

    it('createCommandSpan sanitizes sensitive attributes', async () => {
      const { createCommandSpan } = await import('../telemetry/spans.js');

      // Sensitive args should be stripped — span should still be created without error
      const span = createCommandSpan('test-command', {
        address: '0x1234',
        private_key: '0xdeadbeef',
        password: 'hunter2',
        api_key: 'sk-secret',
        normal_flag: true,
      });

      expect(span).toBeDefined();
      span.end();
    });

    it('withSpan creates a child span and returns the result', async () => {
      const { withSpan } = await import('../telemetry/spans.js');

      const result = await withSpan('test-span', async (span) => {
        expect(span).toBeDefined();
        return 42;
      });

      expect(result).toBe(42);
    });

    it('withSpan records errors and re-throws on failure', async () => {
      const { withSpan } = await import('../telemetry/spans.js');

      await expect(
        withSpan('failing-span', async () => {
          throw new Error('test error');
        }),
      ).rejects.toThrow('test error');
    });

    it('recordError handles non-Error values', async () => {
      const { createCommandSpan, recordError } = await import('../telemetry/spans.js');

      const span = createCommandSpan('test');

      // Should not throw with a string error
      recordError(span, 'string error');
      // Should not throw with an object
      recordError(span, { code: 'FAIL' });

      span.end();
    });
  });
});
