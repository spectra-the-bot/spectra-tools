# @spectra-the-bot/cli-shared

Shared middleware, utilities, and testing helpers used across `@spectra-the-bot` CLI packages.

## Installation

```bash
pnpm add @spectra-the-bot/cli-shared
```

## Import paths

```ts
import { ... } from '@spectra-the-bot/cli-shared';
import { ... } from '@spectra-the-bot/cli-shared/middleware';
import { ... } from '@spectra-the-bot/cli-shared/utils';
import { ... } from '@spectra-the-bot/cli-shared/testing';
```

---

## Middleware

### `apiKeyAuth` + `MissingApiKeyError` (auth)

Reads an API key from an env var and throws a typed error if missing.

```ts
import { apiKeyAuth, MissingApiKeyError } from '@spectra-the-bot/cli-shared/middleware';

try {
  const { apiKey } = apiKeyAuth('ETHERSCAN_API_KEY');
  // use apiKey in request headers
} catch (err) {
  if (err instanceof MissingApiKeyError) {
    console.error(err.message);
  }
}
```

---

### `withRetry` (retry)

Wraps async calls with exponential backoff + jitter.

- Retries up to `maxRetries`
- Delay grows from `baseMs` to `maxMs`
- For `HttpError` 429/503, respects `Retry-After` headers

```ts
import { withRetry } from '@spectra-the-bot/cli-shared/middleware';

const result = await withRetry(
  () => fetch('https://example.com/data').then((r) => r.json()),
  {
    maxRetries: 4,
    baseMs: 200,
    maxMs: 5_000,
  },
);
```

---

### `createRateLimiter` + `withRateLimit` (rate-limit)

Token-bucket rate limiter for request throughput control.

```ts
import { createRateLimiter, withRateLimit } from '@spectra-the-bot/cli-shared/middleware';

const acquire = createRateLimiter({ requestsPerSecond: 5 });

const data = await withRateLimit(
  () => fetch('https://example.com/items').then((r) => r.json()),
  acquire,
);
```

---

### `paginateCursor` + `paginateOffset` (pagination)

Async iterators that flatten paged APIs.

#### Cursor pagination

```ts
import { paginateCursor } from '@spectra-the-bot/cli-shared/middleware';

for await (const item of paginateCursor({
  fetchPage: async (cursor) => {
    const res = await fetch(`/api/items?cursor=${cursor ?? ''}`).then((r) => r.json());
    return { items: res.items, nextCursor: res.nextCursor };
  },
})) {
  console.log(item);
}
```

#### Offset pagination

```ts
import { paginateOffset } from '@spectra-the-bot/cli-shared/middleware';

for await (const item of paginateOffset({
  limit: 100,
  fetchPage: async (offset, limit) => {
    const res = await fetch(`/api/items?offset=${offset}&limit=${limit}`).then((r) => r.json());
    return { items: res.items, total: res.total };
  },
})) {
  console.log(item);
}
```

---

## Utils

### `createHttpClient` + `HttpError` (http client)

Typed fetch wrapper with:

- `baseUrl`
- default and per-request headers
- query serialization
- JSON request body encoding
- `HttpError` on non-2xx responses

```ts
import { createHttpClient, HttpError } from '@spectra-the-bot/cli-shared/utils';

type Proposal = { id: string; title: string };

const client = createHttpClient({
  baseUrl: 'https://api.assembly.abs.xyz',
  defaultHeaders: {
    'X-Api-Key': process.env.ASSEMBLY_API_KEY ?? '',
  },
});

try {
  const proposals = await client.request<Proposal[]>('/v1/proposals', {
    query: { status: 'active' },
  });
  console.log(proposals);
} catch (err) {
  if (err instanceof HttpError) {
    console.error(err.status, err.statusText, err.body);
  }
}
```

---

### Format helpers (`weiToEth`, `checksumAddress`, `formatTimestamp`, `truncate`) (format)

```ts
import {
  weiToEth,
  checksumAddress,
  formatTimestamp,
  truncate,
} from '@spectra-the-bot/cli-shared/utils';

weiToEth('1234500000000000000');
// => "1.2345"

checksumAddress('0x742d35cc6634c0532925a3b844bc454e4438f44e');
// => EIP-55 checksummed address

formatTimestamp(1700000000);
// => "2023-11-14T22:13:20.000Z"

truncate('0x742d35cc6634c0532925a3b844bc454e4438f44e');
// => "0x742d...f44e"
```

---

## Testing

### `createMockServer` (mock-server)

Spin up a lightweight local HTTP server for integration tests.

- Configure route responses (`addRoute`)
- Record incoming requests (`requests`)
- Cleanly close after tests (`close`)

```ts
import { createMockServer } from '@spectra-the-bot/cli-shared/testing';

const server = await createMockServer();

server.addRoute('GET', '/v1/proposals', {
  status: 200,
  body: [{ id: '1', title: 'Test Proposal' }],
});

const res = await fetch(`${server.url}/v1/proposals`);
const data = await res.json();

console.log(data);
console.log(server.requests[0]); // method/url/headers/body

await server.close();
```

---

## Export summary

- **Middleware**: `apiKeyAuth`, `MissingApiKeyError`, `withRetry`, `createRateLimiter`, `withRateLimit`, `paginateCursor`, `paginateOffset`
- **Utils**: `createHttpClient`, `HttpError`, `weiToEth`, `checksumAddress`, `formatTimestamp`, `truncate`
- **Testing**: `createMockServer`
