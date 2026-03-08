# @spectra-the-bot/assembly-cli

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
