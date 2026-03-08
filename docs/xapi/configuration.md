# X API CLI Configuration

`xapi-cli` authenticates with environment variables. You must set at least one token.

## `X_BEARER_TOKEN` (app-only, read operations)

`X_BEARER_TOKEN` is an app-only bearer token for read-focused workflows:

- `posts get`, `posts search`, `posts likes`, `posts retweets`
- `users get`, `users followers`, `users following`, `users posts`, `users mentions`
- `timeline home`, `timeline mentions`
- `lists get`, `lists members`, `lists posts`
- `trends places`, `trends location` (subject to elevated access limits)

```bash
export X_BEARER_TOKEN="your-app-bearer-token"
```

## `X_ACCESS_TOKEN` (OAuth 2.0 user context)

`X_ACCESS_TOKEN` is an OAuth 2.0 user-context token.

Use it for:

- **Write operations** (required):
  - `posts create`
  - `posts delete`
  - `dm send`
- **Reads that may require user context**:
  - `users search`
  - some timeline/DM-related access patterns depending on account/project access

```bash
export X_ACCESS_TOKEN="your-oauth2-user-access-token"
```

## Token precedence

If both variables are set, `xapi-cli` prefers `X_ACCESS_TOKEN`.

```bash
export X_BEARER_TOKEN="..."
export X_ACCESS_TOKEN="..."
```

## Known limitations

### Trends may require elevated X access

`trends` commands use X API v1.1 trend endpoints. Depending on your X developer project tier, these endpoints may be unavailable or return limited/no data.

### `users search` may require OAuth user context

`users search` can fail in app-only bearer mode for some projects. If that happens, set `X_ACCESS_TOKEN` and retry.

## Troubleshooting

- Write command auth failure: ensure `X_ACCESS_TOKEN` is set and has write scopes.
- Endpoint-specific auth errors: keep both tokens available so CLI can use user context where needed.
- Empty trends responses: verify your project access tier includes trends endpoints.
