import { _getSdk } from './init.js';

/**
 * Flush pending spans/metrics and shut down the OTEL SDK.
 *
 * Safe to call even if telemetry was never initialized — in that case it is a no-op.
 */
export async function shutdownTelemetry(): Promise<void> {
  const sdk = _getSdk();
  if (!sdk) return;

  await sdk.shutdown();
}
