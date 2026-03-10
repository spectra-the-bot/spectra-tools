import type { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | undefined;
let initialized = false;

/**
 * Check whether OTEL telemetry should be enabled based on environment variables.
 */
function isOtelEnabled(): boolean {
  return !!(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.SPECTRA_OTEL_ENABLED === 'true');
}

/**
 * Initialize OpenTelemetry SDK for a CLI service.
 *
 * This is a **lazy** initializer — if neither `OTEL_EXPORTER_OTLP_ENDPOINT` nor
 * `SPECTRA_OTEL_ENABLED=true` is set, it returns immediately without importing
 * any OTEL modules, ensuring zero overhead when instrumentation is disabled.
 *
 * @param serviceName - Logical name of the CLI service (used as fallback for `service.name`).
 */
export function initTelemetry(serviceName: string): void {
  if (initialized) return;
  initialized = true;

  if (!isOtelEnabled()) return;

  // Lazy-load all OTEL modules only when telemetry is actually enabled.
  // Using require() ensures zero module-load overhead when OTEL is disabled.
  // biome-ignore lint/suspicious/noExplicitAny: lazy require casts
  const sdkMod = require('@opentelemetry/sdk-node') as any;
  // biome-ignore lint/suspicious/noExplicitAny: lazy require casts
  const traceExpMod = require('@opentelemetry/exporter-trace-otlp-http') as any;
  // biome-ignore lint/suspicious/noExplicitAny: lazy require casts
  const metricExpMod = require('@opentelemetry/exporter-metrics-otlp-http') as any;
  // biome-ignore lint/suspicious/noExplicitAny: lazy require casts
  const metricsMod = require('@opentelemetry/sdk-metrics') as any;
  // biome-ignore lint/suspicious/noExplicitAny: lazy require casts
  const resourcesMod = require('@opentelemetry/resources') as any;
  // biome-ignore lint/suspicious/noExplicitAny: lazy require casts
  const semconvMod = require('@opentelemetry/semantic-conventions') as any;

  let version = '0.0.0';
  try {
    const pkg = require('../../package.json') as { version?: string };
    version = pkg.version ?? version;
  } catch {
    // package.json may not be resolvable at runtime — use fallback
  }

  const resolvedServiceName = process.env.OTEL_SERVICE_NAME || `spectra-${serviceName}`;

  const resource = resourcesMod.resourceFromAttributes({
    [semconvMod.ATTR_SERVICE_NAME]: resolvedServiceName,
    [semconvMod.ATTR_SERVICE_VERSION]: version,
  });

  const traceExporter = new traceExpMod.OTLPTraceExporter();
  const metricExporter = new metricExpMod.OTLPMetricExporter();

  sdk = new sdkMod.NodeSDK({
    resource,
    traceExporter,
    metricReader: new metricsMod.PeriodicExportingMetricReader({
      exporter: metricExporter,
    }),
  }) as NodeSDK;

  sdk.start();

  const shutdown = () => {
    sdk?.shutdown().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

/**
 * Returns the active SDK instance, if any. Used internally by shutdown logic.
 * @internal
 */
export function _getSdk(): NodeSDK | undefined {
  return sdk;
}

/**
 * Returns whether `initTelemetry` has been called (regardless of whether OTEL is enabled).
 * @internal
 */
export function _isInitialized(): boolean {
  return initialized;
}

/**
 * Reset internal state — **test-only**.
 * @internal
 */
export function _resetForTesting(): void {
  sdk = undefined;
  initialized = false;
}
