# @spectra-the-bot/cli-shared

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
