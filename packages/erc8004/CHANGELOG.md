# @spectra-the-bot/erc8004-cli

## 0.1.2

### Patch Changes

- [#167](https://github.com/spectra-the-bot/spectra-tools/pull/167) [`eb5c491`](https://github.com/spectra-the-bot/spectra-tools/commit/eb5c49103b5ec99ab6dba38159e3654ddd9e316f) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Map contract revert errors to structured error codes for reputation/validation commands.

## 0.1.1

### Patch Changes

- [#159](https://github.com/spectra-the-bot/spectra-tools/pull/159) [`63b7475`](https://github.com/spectra-the-bot/spectra-tools/commit/63b7475aa7c97646ea635c5f9b772018f7965c1d) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add agentId validation to return structured error instead of raw BigInt exception.

- [#147](https://github.com/spectra-the-bot/spectra-tools/pull/147) [`8172cdd`](https://github.com/spectra-the-bot/spectra-tools/commit/8172cdd5c397cac8f0c06769c16e86f0f26ffadb) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Remove CTA objects from JSON output across etherscan, xapi, and erc8004 CLIs.

- [#143](https://github.com/spectra-the-bot/spectra-tools/pull/143) [`0fb568f`](https://github.com/spectra-the-bot/spectra-tools/commit/0fb568f3d2241f30a4f1beec4ad60972e31fb327) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix --version flag to print version number instead of help text.

## 0.1.0

### Minor Changes

- [#119](https://github.com/spectra-the-bot/spectra-tools/pull/119) [`94dd56a`](https://github.com/spectra-the-bot/spectra-tools/commit/94dd56a4267e1a66c1f5089f804d4a5a5d016e16) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add end-to-end invocation tests for symlink, npx, and pack+install workflows across all CLI packages.

## 0.0.9

### Patch Changes

- [#115](https://github.com/spectra-the-bot/spectra-tools/pull/115) [`ed00af7`](https://github.com/spectra-the-bot/spectra-tools/commit/ed00af74108cb211d8c2e2fecb77a6522cfcc44d) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - add Abstract mainnet default addresses for reputation/validation registries, add per-command `--registry` overrides, and update docs to describe default registry behavior.

## 0.0.8

### Patch Changes

- [#112](https://github.com/spectra-the-bot/spectra-tools/pull/112) [`6579024`](https://github.com/spectra-the-bot/spectra-tools/commit/6579024814bfe85cd9c0e4e348b5d86ffbe18ba4) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix `identity list` and `discovery search` for non-enumerable registries by avoiding owner-path `totalSupply()` usage, adding owner event-based lookup, and returning structured friendly errors instead of raw viem errors.

## 0.0.7

### Patch Changes

- [#92](https://github.com/spectra-the-bot/spectra-tools/pull/92) [`b85c533`](https://github.com/spectra-the-bot/spectra-tools/commit/b85c533dc47ac8885aae2ad1f77fb7ae9ab03b67) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix CLI entrypoint main-module detection to resolve symlinks before comparison. This restores npm/npx/bin invocations that run through `node_modules/.bin` symlinks instead of direct file paths.

## 0.0.6

### Patch Changes

- [#76](https://github.com/spectra-the-bot/spectra-tools/pull/76) [`15226db`](https://github.com/spectra-the-bot/spectra-tools/commit/15226db3836597e9a0b3c9c70b811fda28cbd593) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Batch ERC-8004 identity, discovery, reputation, and validation reads with multicall and graceful per-call failure handling.

## 0.0.5

### Patch Changes

- [#75](https://github.com/spectra-the-bot/spectra-tools/pull/75) [`b2aefd6`](https://github.com/spectra-the-bot/spectra-tools/commit/b2aefd6752a9a1a63569b2c7340e99875c66ace3) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Normalize package.json formatting for published package manifests to satisfy Biome CI checks.

## 0.0.4

### Patch Changes

- [#72](https://github.com/spectra-the-bot/spectra-tools/pull/72) [`350a02c`](https://github.com/spectra-the-bot/spectra-tools/commit/350a02c8faa84242b1fb349ad3662771b65f28b0) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Document and expose `IPFS_GATEWAY` for ERC-8004 registration and discovery URI fetching.

## 0.0.2

### Patch Changes

- Updated dependencies [[`348e9d6`](https://github.com/spectra-the-bot/spectra-tools/commit/348e9d63aa509e6d5aeb11721b54a6619a69979c)]:
  - @spectra-the-bot/cli-shared@0.1.0
