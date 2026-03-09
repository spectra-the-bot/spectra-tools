# @spectra-the-bot/assembly-cli

## 0.8.2

### Patch Changes

- Updated dependencies [[`eb5cd26`](https://github.com/spectra-the-bot/spectra-tools/commit/eb5cd267799b69521cbf364a792b1de1f9b06e8d), [`e750281`](https://github.com/spectra-the-bot/spectra-tools/commit/e750281e12ecd4ed695f73a956afa3285ad134e8)]:
  - @spectratools/tx-shared@0.4.2

## 0.8.1

### Patch Changes

- [#189](https://github.com/spectra-the-bot/spectra-tools/pull/189) [`44331aa`](https://github.com/spectra-the-bot/spectra-tools/commit/44331aadf5501e5e75c1af2a3d6228ea68655f6c) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Document tx-shared signer providers and transaction lifecycle with assembly integration examples.

- [#186](https://github.com/spectra-the-bot/spectra-tools/pull/186) [`2b6033f`](https://github.com/spectra-the-bot/spectra-tools/commit/2b6033f3fecb9baaa0e840ff5154a468c216a7fe) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Distinguish bid-executable auction slots from upcoming windows in council auction status output.

- Updated dependencies [[`44331aa`](https://github.com/spectra-the-bot/spectra-tools/commit/44331aadf5501e5e75c1af2a3d6228ea68655f6c)]:
  - @spectratools/tx-shared@0.4.1

## 0.8.0

### Minor Changes

- [#181](https://github.com/spectra-the-bot/spectra-tools/pull/181) [`c6f6564`](https://github.com/spectra-the-bot/spectra-tools/commit/c6f6564e636c38b8cef822a486f5a35dc762894d) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add fuzzy member lookup support for `assembly members info` using partial address, ENS, or name metadata.

### Patch Changes

- Updated dependencies [[`68bb9f8`](https://github.com/spectra-the-bot/spectra-tools/commit/68bb9f8dda5b69eb3ded30752128c5c7f95d9c85)]:
  - @spectratools/tx-shared@0.4.0

## 0.7.0

### Minor Changes

- [#175](https://github.com/spectra-the-bot/spectra-tools/pull/175) [`405781b`](https://github.com/spectra-the-bot/spectra-tools/commit/405781b5ba1ec9485b4f7fcdc00983f4f3bc116b) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add council write commands: bid, settle, withdraw-refund.

- [#174](https://github.com/spectra-the-bot/spectra-tools/pull/174) [`e231309`](https://github.com/spectra-the-bot/spectra-tools/commit/e231309a1953cbbea7c79e7db609ff8b7a93fd5c) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add membership write commands: register, heartbeat, renew.

### Patch Changes

- [#178](https://github.com/spectra-the-bot/spectra-tools/pull/178) [`b3ec9e2`](https://github.com/spectra-the-bot/spectra-tools/commit/b3ec9e215683c55e28ff2811610ec7c4f21fff93) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Update incur to latest — adopt --llms compact index + --llms-full flags.

## 0.6.0

### Minor Changes

- [#162](https://github.com/spectra-the-bot/spectra-tools/pull/162) [`e5d8f5d`](https://github.com/spectra-the-bot/spectra-tools/commit/e5d8f5d79c2017494faedd0c4e09b1babd51d760) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add write command infrastructure with wallet client, signer resolution, and tx receipt formatting.

### Patch Changes

- [#163](https://github.com/spectra-the-bot/spectra-tools/pull/163) [`1beb7c7`](https://github.com/spectra-the-bot/spectra-tools/commit/1beb7c7d898e7b2d260baa4622a0227ecef833f6) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - docs: add VitePress overview, configuration, and guide pages.

## 0.5.1

### Patch Changes

- [#142](https://github.com/spectra-the-bot/spectra-tools/pull/142) [`546c492`](https://github.com/spectra-the-bot/spectra-tools/commit/546c492843e2fdcf65fd4614debf47349202da98) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add pre-validation for council auction slot bounds to return clean OUT_OF_RANGE error.

- [#143](https://github.com/spectra-the-bot/spectra-tools/pull/143) [`0fb568f`](https://github.com/spectra-the-bot/spectra-tools/commit/0fb568f3d2241f30a4f1beec4ad60972e31fb327) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix --version flag to print version number instead of help text.

## 0.5.0

### Minor Changes

- [#119](https://github.com/spectra-the-bot/spectra-tools/pull/119) [`94dd56a`](https://github.com/spectra-the-bot/spectra-tools/commit/94dd56a4267e1a66c1f5089f804d4a5a5d016e16) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add end-to-end invocation tests for symlink, npx, and pack+install workflows across all CLI packages.

### Patch Changes

- [#118](https://github.com/spectra-the-bot/spectra-tools/pull/118) [`3646038`](https://github.com/spectra-the-bot/spectra-tools/commit/36460383ad441c621a86ae0335a71594bc287c35) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Remove CTA metadata from JSON output for council auctions, forum threads, and governance proposals.

## 0.4.3

### Patch Changes

- [#111](https://github.com/spectra-the-bot/spectra-tools/pull/111) [`b473e00`](https://github.com/spectra-the-bot/spectra-tools/commit/b473e00c26e009595f2bc8a3ed1112d846ec7d8f) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add human-readable governance proposal status labels and include raw `statusCode` in proposal list/detail outputs.

## 0.4.2

### Patch Changes

- [#101](https://github.com/spectra-the-bot/spectra-tools/pull/101) [`fd8b89d`](https://github.com/spectra-the-bot/spectra-tools/commit/fd8b89da80a0e3aff17e054da0d1a312fecb4119) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Return ISO 8601 strings for timestamp fields in JSON output while preserving `*Relative` helper fields for human-readable relative times.

## 0.4.1

### Patch Changes

- [#92](https://github.com/spectra-the-bot/spectra-tools/pull/92) [`b85c533`](https://github.com/spectra-the-bot/spectra-tools/commit/b85c533dc47ac8885aae2ad1f77fb7ae9ab03b67) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix CLI entrypoint main-module detection to resolve symlinks before comparison. This restores npm/npx/bin invocations that run through `node_modules/.bin` symlinks instead of direct file paths.

## 0.4.0

### Minor Changes

- [#80](https://github.com/spectra-the-bot/spectra-tools/pull/80) [`d3856e0`](https://github.com/spectra-the-bot/spectra-tools/commit/d3856e0f9cf14c9c171492cd0b722bfaa1364984) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add out-of-range validation for Assembly entity ID commands before on-chain reads.

### Patch Changes

- [#79](https://github.com/spectra-the-bot/spectra-tools/pull/79) [`c5e5eb2`](https://github.com/spectra-the-bot/spectra-tools/commit/c5e5eb2798021b9541a707bea221667d200ab127) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Remove the broken package export that pointed to non-existent dist/index files.

- [#84](https://github.com/spectra-the-bot/spectra-tools/pull/84) [`479614a`](https://github.com/spectra-the-bot/spectra-tools/commit/479614a8e2edc8608973eb13fcd720c791703087) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix members list JSON output to return a stable `{ members, count }` envelope.

## 0.3.2

### Patch Changes

- [#75](https://github.com/spectra-the-bot/spectra-tools/pull/75) [`b2aefd6`](https://github.com/spectra-the-bot/spectra-tools/commit/b2aefd6752a9a1a63569b2c7340e99875c66ace3) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Normalize package.json formatting for published package manifests to satisfy Biome CI checks.

## 0.3.1

### Patch Changes

- [#74](https://github.com/spectra-the-bot/spectra-tools/pull/74) [`67d1215`](https://github.com/spectra-the-bot/spectra-tools/commit/67d12154bae7e745e6a7ac2b1376e04ecb762651) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Wrap forum thread and governance proposal list outputs in named objects when CTAs are present to keep JSON shapes stable.

## 0.3.0

### Minor Changes

- [#69](https://github.com/spectra-the-bot/spectra-tools/pull/69) [`ed2747d`](https://github.com/spectra-the-bot/spectra-tools/commit/ed2747d01819a59d39378f85c56434224c7bcf31) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add council auction window timing and derived bidding/closed/settled status fields to auction outputs.

### Patch Changes

- [#61](https://github.com/spectra-the-bot/spectra-tools/pull/61) [`4cb6df5`](https://github.com/spectra-the-bot/spectra-tools/commit/4cb6df522f22dc52284e129b83072f773709979a) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Update Assembly package documentation and metadata for public launch readiness

- [#70](https://github.com/spectra-the-bot/spectra-tools/pull/70) [`290b942`](https://github.com/spectra-the-bot/spectra-tools/commit/290b9422b4f28247ad0f7f6111d2d2b98ab658d1) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Start member fallback event scans at the Registry deployment block and fail fast on long-running fallback scans.

## 0.2.0

### Minor Changes

- Assembly CLI v0.2.0: Fixed struct decoding for all contract types (#50), added indexer fallback with on-chain Registered event scanning (#51), README rewritten for public context (#52), BigInt serialization safety across all commands, dedicated tuple decoders for seats, auctions, threads, comments, petitions, and proposals.

## 0.1.0

### Minor Changes

- [#3](https://github.com/spectra-the-bot/spectra-tools/pull/3) [`0462a34`](https://github.com/spectra-the-bot/spectra-tools/commit/0462a345713854e1a25e680530973137c2cd9854) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Initial release of `@spectra-the-bot/assembly-cli`.

  Implements the Assembly governance CLI for Abstract chain with the following command groups:

  - `proposals list/get/vote` — list, inspect, and vote on governance proposals
  - `council members/info/seats` — explore council members and seat status
  - `forum posts/post/search` — browse the Assembly governance forum
  - `members list/info/status` — inspect Assembly membership and voting power
  - `votes history/tally` — view voting history and proposal tallies

  Built on the `incur` framework with typed Zod schemas, CTAs, and support for `ASSEMBLY_API_KEY` and `ABSTRACT_RPC_URL` environment variables.

### Patch Changes

- Updated dependencies [[`348e9d6`](https://github.com/spectra-the-bot/spectra-tools/commit/348e9d63aa509e6d5aeb11721b54a6619a69979c)]:
  - @spectra-the-bot/cli-shared@0.1.0
