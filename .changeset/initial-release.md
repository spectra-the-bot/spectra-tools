---
'@spectra-the-bot/cli-shared': minor
---

Initial release of `@spectra-the-bot/cli-shared`.

Includes:
- `apiKeyAuth` middleware for reading API keys from environment variables
- `withRetry` middleware with exponential backoff and Retry-After support
- `createRateLimiter` / `withRateLimit` token bucket rate limiting
- `paginateCursor` / `paginateOffset` async iterator helpers for pagination
- `createHttpClient` typed fetch wrapper with query serialization and error handling
- `weiToEth`, `checksumAddress`, `formatTimestamp`, `truncate` formatting utilities
- `createMockServer` test helper for integration testing
