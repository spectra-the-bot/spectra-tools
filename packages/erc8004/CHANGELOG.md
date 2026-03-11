# @spectra-the-bot/erc8004-cli

## 0.4.4

### Patch Changes

- Updated dependencies [[`152941a`](https://github.com/spectra-the-bot/spectra-tools/commit/152941a9a542bc33964e44f6ff9d253653fabdac)]:
  - @spectratools/cli-shared@0.3.0

## 0.4.3

### Patch Changes

- Updated dependencies [[`dad2a60`](https://github.com/spectra-the-bot/spectra-tools/commit/dad2a6071f23bbb75bd4028dfb2b79f8aa3c9dce)]:
  - @spectratools/cli-shared@0.2.1

## 0.4.2

### Patch Changes

- Updated dependencies [[`6f2d227`](https://github.com/spectra-the-bot/spectra-tools/commit/6f2d2272d310069f8cc936c22c3518d1f6e4ffcf)]:
  - @spectratools/cli-shared@0.2.0

## 0.4.1

### Patch Changes

- [#386](https://github.com/spectra-the-bot/spectra-tools/pull/386) [`79c57d2`](https://github.com/spectra-the-bot/spectra-tools/commit/79c57d2d06293d929a59a92bcb09ee5a16397d3b) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix package-root export by building `src/index.ts` so `dist/index.js` exists in the published artifact.

- Updated dependencies [[`e5e4724`](https://github.com/spectra-the-bot/spectra-tools/commit/e5e47248d538c261e0fa8436bd1ba7c3f2807aaf)]:
  - @spectratools/cli-shared@0.1.2

## 0.4.0

### Minor Changes

- [#275](https://github.com/spectra-the-bot/spectra-tools/pull/275) [`1800503`](https://github.com/spectra-the-bot/spectra-tools/commit/180050375f6c5b2ea46d18818568d75167be5bdd) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add validation submit-result and cancel commands for the validator-side workflow.

## 0.3.0

### Minor Changes

- [#238](https://github.com/spectra-the-bot/spectra-tools/pull/238) [`bf23923`](https://github.com/spectra-the-bot/spectra-tools/commit/bf23923477240bbcd562399c9d425b0021ea9dc7) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add identity burn command for permanently destroying agent identity tokens. Currently returns BURN_NOT_SUPPORTED as the IdentityRegistry contract does not expose a public burn function.

## 0.2.0

### Minor Changes

- [#227](https://github.com/spectra-the-bot/spectra-tools/pull/227) [`a2b97fe`](https://github.com/spectra-the-bot/spectra-tools/commit/a2b97fe0ec121328f1db1513cba6bf365348e693) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add `identity set-metadata` and `identity transfer` commands.

  - `identity set-metadata <agentId> --key <key> --value <value>`: Write a metadata key-value pair on an agent identity (requires signer).
  - `identity transfer <agentId> --to <address>`: Transfer an agent identity token to a new owner via `safeTransferFrom` (default) or `transferFrom` (`--no-safe`). Includes ownership pre-check and zero-address guard.
  - ABI additions: `transferFrom`, `safeTransferFrom`, `approve`, `getApproved`, `setApprovalForAll`, `isApprovedForAll` (standard ERC-721 functions).

## 0.1.4

### Patch Changes

- [#178](https://github.com/spectra-the-bot/spectra-tools/pull/178) [`b3ec9e2`](https://github.com/spectra-the-bot/spectra-tools/commit/b3ec9e215683c55e28ff2811610ec7c4f21fff93) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Update incur to latest — adopt --llms compact index + --llms-full flags.

## 0.1.3

### Patch Changes

- [#166](https://github.com/spectra-the-bot/spectra-tools/pull/166) [`4de0c4c`](https://github.com/spectra-the-bot/spectra-tools/commit/4de0c4c372d9579507a637c41e8d6296964a3609) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - docs(erc8004): add VitePress overview, configuration, and guide pages.

- [#166](https://github.com/spectra-the-bot/spectra-tools/pull/166) [`4de0c4c`](https://github.com/spectra-the-bot/spectra-tools/commit/4de0c4c372d9579507a637c41e8d6296964a3609) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Map reputation/validation registry read reverts to structured CLI error codes instead of surfacing raw contract errors.

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
