# @spectra-the-bot/xapi-cli

## 0.1.2

### Patch Changes

- [#92](https://github.com/spectra-the-bot/spectra-tools/pull/92) [`b85c533`](https://github.com/spectra-the-bot/spectra-tools/commit/b85c533dc47ac8885aae2ad1f77fb7ae9ab03b67) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix CLI entrypoint main-module detection to resolve symlinks before comparison. This restores npm/npx/bin invocations that run through `node_modules/.bin` symlinks instead of direct file paths.

## 0.1.0

### Minor Changes

- [#4](https://github.com/spectra-the-bot/spectra-tools/pull/4) [`9581e47`](https://github.com/spectra-the-bot/spectra-tools/commit/9581e47df42d22fb9b6f903feea8c42020c2b88f) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Initial release of `@spectra-the-bot/xapi-cli`.

  Implements the X (Twitter) API v2 CLI with the following commands:

  - `posts get/search/create/delete/likes/retweets` — post management and discovery
  - `users get/followers/following/posts/mentions/search` — user lookup and exploration
  - `timeline home/mentions` — authenticated timeline access
  - `lists get/members/posts` — X list browsing
  - `trends places/location` — trending topics by WOEID
  - `dm conversations/send` — direct message management

  Features:

  - Bearer token auth via `X_BEARER_TOKEN`
  - Cursor-based pagination with `--max-results`
  - Auto-retry with exponential backoff on 429/503 responses
  - Relative timestamps ("2h ago") and text truncation with `--verbose`
  - CTAs on all commands suggesting next logical actions

### Patch Changes

- Updated dependencies [[`348e9d6`](https://github.com/spectra-the-bot/spectra-tools/commit/348e9d63aa509e6d5aeb11721b54a6619a69979c)]:
  - @spectra-the-bot/cli-shared@0.1.0
