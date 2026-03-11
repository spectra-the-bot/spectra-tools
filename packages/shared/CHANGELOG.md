# @spectra-the-bot/cli-shared

## 0.2.1

### Patch Changes

- [#395](https://github.com/spectra-the-bot/spectra-tools/pull/395) [`dad2a60`](https://github.com/spectra-the-bot/spectra-tools/commit/dad2a6071f23bbb75bd4028dfb2b79f8aa3c9dce) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Improve CI changeset gate reliability in shallow checkout environments by diffing against the PR base SHA.

## 0.2.0

### Minor Changes

- [#389](https://github.com/spectra-the-bot/spectra-tools/pull/389) [`6f2d227`](https://github.com/spectra-the-bot/spectra-tools/commit/6f2d2272d310069f8cc936c22c3518d1f6e4ffcf) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add shared OpenTelemetry initialization module with lazy SDK bootstrap, span helpers, and graceful shutdown. Telemetry activates only when `OTEL_EXPORTER_OTLP_ENDPOINT` or `SPECTRA_OTEL_ENABLED=true` is set, ensuring zero overhead when instrumentation is disabled.

## 0.1.2

### Patch Changes

- [#369](https://github.com/spectra-the-bot/spectra-tools/pull/369) [`e5e4724`](https://github.com/spectra-the-bot/spectra-tools/commit/e5e47248d538c261e0fa8436bd1ba7c3f2807aaf) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Export isAddress utility function that was present in source but missing from the published package.

## 0.1.0

### Minor Changes

- [`348e9d6`](https://github.com/spectra-the-bot/spectra-tools/commit/348e9d63aa509e6d5aeb11721b54a6619a69979c) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Initial release of `@spectra-the-bot/cli-shared`.

  Includes:

  - `apiKeyAuth` middleware for reading API keys from environment variables
  - `withRetry` middleware with exponential backoff and Retry-After support
  - `createRateLimiter` / `withRateLimit` token bucket rate limiting
  - `paginateCursor` / `paginateOffset` async iterator helpers for pagination
  - `createHttpClient` typed fetch wrapper with query serialization and error handling
  - `weiToEth`, `checksumAddress`, `formatTimestamp`, `truncate` formatting utilities
  - `createMockServer` test helper for integration testing
