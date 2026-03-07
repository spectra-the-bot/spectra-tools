# @spectra-the-bot/assembly-cli

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
