# @spectra-the-bot/assembly-cli

## 0.12.0

### Minor Changes

- [#440](https://github.com/spectra-the-bot/spectra-tools/pull/440) [`07e4e54`](https://github.com/spectra-the-bot/spectra-tools/commit/07e4e54fe17f3e1215095dfaba8651da746c731c) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add batch wallet-relative enrichment helpers: `fetchHasVotedBatch` and `fetchHasSignedBatch` for efficient multicall-based vote/sign status checks across multiple proposals or petitions.

### Patch Changes

- [#439](https://github.com/spectra-the-bot/spectra-tools/pull/439) [`90fcf82`](https://github.com/spectra-the-bot/spectra-tools/commit/90fcf82983d61b974655437c8c3764d5ec954a30) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - refactor(assembly): extract shared data-fetching service layer from commands

  Moves decode/fetch logic from inline command handlers into reusable service
  modules under `packages/assembly/src/services/`. No behavioral changes —
  existing command output is identical.

- Updated dependencies [[`9ad215e`](https://github.com/spectra-the-bot/spectra-tools/commit/9ad215e8173a850da9412f48e42fb6eb9c54ec94)]:
  - @spectratools/cli-shared@0.4.1
  - @spectratools/tx-shared@0.6.2

## 0.11.7

### Patch Changes

- Updated dependencies [[`3602983`](https://github.com/spectra-the-bot/spectra-tools/commit/3602983c45c3d6c814e6e77f8773f33a2337bcdb)]:
  - @spectratools/tx-shared@0.6.1

## 0.11.6

### Patch Changes

- [#408](https://github.com/spectra-the-bot/spectra-tools/pull/408) [`69a82c3`](https://github.com/spectra-the-bot/spectra-tools/commit/69a82c35a6e4addc0047fd4081ca26b9455655e2) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add explicit exports map and build src/index.ts for stable package-root imports.

- [#407](https://github.com/spectra-the-bot/spectra-tools/pull/407) [`23d12a9`](https://github.com/spectra-the-bot/spectra-tools/commit/23d12a9583876bce0aca505a05d794e42d26c90a) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix stale command examples in docs to match current CLI output.

- [#412](https://github.com/spectra-the-bot/spectra-tools/pull/412) [`a1b9638`](https://github.com/spectra-the-bot/spectra-tools/commit/a1b9638bbd2ba0e1479721b934612b93eaa35101) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Wire OTEL telemetry initialization and root command spans across all CLI packages.

- Updated dependencies [[`58bed96`](https://github.com/spectra-the-bot/spectra-tools/commit/58bed96fd22615ae6654d630e2e4e5b15099089d), [`8f0c670`](https://github.com/spectra-the-bot/spectra-tools/commit/8f0c6707163c26bd1db88264ac217c7ee56007f5), [`a1b9638`](https://github.com/spectra-the-bot/spectra-tools/commit/a1b9638bbd2ba0e1479721b934612b93eaa35101)]:
  - @spectratools/cli-shared@0.4.0
  - @spectratools/tx-shared@0.6.0

## 0.11.5

### Patch Changes

- [#409](https://github.com/spectra-the-bot/spectra-tools/pull/409) [`63aeede`](https://github.com/spectra-the-bot/spectra-tools/commit/63aeede2ccb834415b728e888c081240394a4d61) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add `exports["."]` map to aborean-cli and assembly-cli package.json, and extend packed-artifact e2e test to validate package-root imports for all CLI packages with root exports.

- [#403](https://github.com/spectra-the-bot/spectra-tools/pull/403) [`5e22fc9`](https://github.com/spectra-the-bot/spectra-tools/commit/5e22fc97f0de47ed6a0ba03f628648843a520706) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix package-root import: dist/index.js was missing from published artifact because src/index.ts was not included in tsup entry points. Closes #401.

- Updated dependencies [[`152941a`](https://github.com/spectra-the-bot/spectra-tools/commit/152941a9a542bc33964e44f6ff9d253653fabdac)]:
  - @spectratools/cli-shared@0.3.0

## 0.11.4

### Patch Changes

- Updated dependencies [[`dad2a60`](https://github.com/spectra-the-bot/spectra-tools/commit/dad2a6071f23bbb75bd4028dfb2b79f8aa3c9dce)]:
  - @spectratools/cli-shared@0.2.1

## 0.11.3

### Patch Changes

- Updated dependencies [[`6f2d227`](https://github.com/spectra-the-bot/spectra-tools/commit/6f2d2272d310069f8cc936c22c3518d1f6e4ffcf)]:
  - @spectratools/cli-shared@0.2.0

## 0.11.2

### Patch Changes

- Updated dependencies [[`e5e4724`](https://github.com/spectra-the-bot/spectra-tools/commit/e5e47248d538c261e0fa8436bd1ba7c3f2807aaf)]:
  - @spectratools/cli-shared@0.1.2

## 0.11.1

### Patch Changes

- Updated dependencies [[`4e7ca4b`](https://github.com/spectra-the-bot/spectra-tools/commit/4e7ca4b27bdae5365757cd37bc7e09670e6c58f0)]:
  - @spectratools/tx-shared@0.5.3

## 0.11.0

### Minor Changes

- [#232](https://github.com/spectra-the-bot/spectra-tools/pull/232) [`fe23015`](https://github.com/spectra-the-bot/spectra-tools/commit/fe2301583188b383ba4ba2e5e0d1f8529b28450d) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add forum create-petition command for submitting new Assembly petitions onchain.

## 0.10.1

### Patch Changes

- [#223](https://github.com/spectra-the-bot/spectra-tools/pull/223) [`5e9555e`](https://github.com/spectra-the-bot/spectra-tools/commit/5e9555e5c7262c32e592b0d76c8e9e35f5be962f) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Finalize Privy rollout docs and parsing coverage, including API URL override guidance and consumer README references.

- Updated dependencies [[`5e9555e`](https://github.com/spectra-the-bot/spectra-tools/commit/5e9555e5c7262c32e592b0d76c8e9e35f5be962f)]:
  - @spectratools/tx-shared@0.5.2

## 0.10.0

### Minor Changes

- [#220](https://github.com/spectra-the-bot/spectra-tools/pull/220) [`2d74700`](https://github.com/spectra-the-bot/spectra-tools/commit/2d74700cbc642982da965b9c38ca8f28cf304dac) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add forum and treasury write commands for posting, commenting, signing petitions, and proposing treasury spends.

### Patch Changes

- Updated dependencies [[`3a8eba2`](https://github.com/spectra-the-bot/spectra-tools/commit/3a8eba2eafb971257aab1b88c604d06fd73dcf46)]:
  - @spectratools/tx-shared@0.5.1

## 0.9.1

### Patch Changes

- Updated dependencies [[`5a9f8dc`](https://github.com/spectra-the-bot/spectra-tools/commit/5a9f8dcf5966606107b98aa12a797095c532e757)]:
  - @spectratools/tx-shared@0.5.0

## 0.9.0

### Minor Changes

- [#208](https://github.com/spectra-the-bot/spectra-tools/pull/208) [`8ab3837`](https://github.com/spectra-the-bot/spectra-tools/commit/8ab38372be0502c676aa56b2ce88b0e7bcc0d366) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add governance write commands (`vote`, `propose`, `queue`, `execute`) with preflight validation, dry-run support, and tests.

### Patch Changes

- Updated dependencies [[`c1a5268`](https://github.com/spectra-the-bot/spectra-tools/commit/c1a5268bfc07aab756501ba59d2899d298f937f3)]:
  - @spectratools/tx-shared@0.4.3

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
