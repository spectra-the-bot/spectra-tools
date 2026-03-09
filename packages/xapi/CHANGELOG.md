# @spectra-the-bot/xapi-cli

## 0.5.0

### Minor Changes

- [#215](https://github.com/spectra-the-bot/spectra-tools/pull/215) [`e39a1ae`](https://github.com/spectra-the-bot/spectra-tools/commit/e39a1aebda001785c583e52c62199e485fb44858) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add missing X API write client methods for social actions and list membership management.

### Patch Changes

- [#219](https://github.com/spectra-the-bot/spectra-tools/pull/219) [`65c0dde`](https://github.com/spectra-the-bot/spectra-tools/commit/65c0dded077644da4cf9b07b5a452991a8eb130b) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add --since-id resume support to timeline home and mentions commands.

## 0.4.0

### Minor Changes

- [#206](https://github.com/spectra-the-bot/spectra-tools/pull/206) [`ed0e485`](https://github.com/spectra-the-bot/spectra-tools/commit/ed0e48581a1fe33d414c6c7033c77fdf18ad740a) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add xapi write commands for posts like/retweet and users follow/unfollow with write-auth error mapping and CLI coverage.

## 0.3.0

### Minor Changes

- [#203](https://github.com/spectra-the-bot/spectra-tools/pull/203) [`74b4fc4`](https://github.com/spectra-the-bot/spectra-tools/commit/74b4fc492cd0b3d60a292dd5363c103f44c5ca34) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add `users me` and baseline-based `users followers --new-only` client-side diffing.

- [#202](https://github.com/spectra-the-bot/spectra-tools/pull/202) [`74c897f`](https://github.com/spectra-the-bot/spectra-tools/commit/74c897f3a2591605edad2bf32f92c32bb3234048) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add social-growth write API primitives and since_id support for timeline polling.

## 0.2.4

### Patch Changes

- [#178](https://github.com/spectra-the-bot/spectra-tools/pull/178) [`b3ec9e2`](https://github.com/spectra-the-bot/spectra-tools/commit/b3ec9e215683c55e28ff2811610ec7c4f21fff93) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Update incur to latest — adopt --llms compact index + --llms-full flags.

## 0.2.3

### Patch Changes

- [#164](https://github.com/spectra-the-bot/spectra-tools/pull/164) [`269a085`](https://github.com/spectra-the-bot/spectra-tools/commit/269a0854ef6150a451129cf9a733876123b94948) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - docs(xapi): add VitePress overview, configuration, and guide pages.

## 0.2.2

### Patch Changes

- [#147](https://github.com/spectra-the-bot/spectra-tools/pull/147) [`8172cdd`](https://github.com/spectra-the-bot/spectra-tools/commit/8172cdd5c397cac8f0c06769c16e86f0f26ffadb) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Remove CTA objects from JSON output across etherscan, xapi, and erc8004 CLIs.

- [#131](https://github.com/spectra-the-bot/spectra-tools/pull/131) [`9c3db1c`](https://github.com/spectra-the-bot/spectra-tools/commit/9c3db1cf34e4a2a1b1f8ad8689abeb52415cea7c) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Improve xapi-cli error handling with client-side maxResults validation and friendlier auth/API error messages.

- [#143](https://github.com/spectra-the-bot/spectra-tools/pull/143) [`0fb568f`](https://github.com/spectra-the-bot/spectra-tools/commit/0fb568f3d2241f30a4f1beec4ad60972e31fb327) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix --version flag to print version number instead of help text.

## 0.2.1

### Patch Changes

- [#127](https://github.com/spectra-the-bot/spectra-tools/pull/127) [`53005bd`](https://github.com/spectra-the-bot/spectra-tools/commit/53005bdc388e432bcc1ea38c7142ce7d3528c1fc) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix trends commands to use X API v1.1 endpoints and normalize responses to existing output shapes.

## 0.2.0

### Minor Changes

- [#119](https://github.com/spectra-the-bot/spectra-tools/pull/119) [`94dd56a`](https://github.com/spectra-the-bot/spectra-tools/commit/94dd56a4267e1a66c1f5089f804d4a5a5d016e16) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add end-to-end invocation tests for symlink, npx, and pack+install workflows across all CLI packages.

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
