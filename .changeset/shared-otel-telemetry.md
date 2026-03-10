---
'@spectratools/cli-shared': minor
---

Add shared OpenTelemetry initialization module with lazy SDK bootstrap, span helpers, and graceful shutdown. Telemetry activates only when `OTEL_EXPORTER_OTLP_ENDPOINT` or `SPECTRA_OTEL_ENABLED=true` is set, ensuring zero overhead when instrumentation is disabled.
