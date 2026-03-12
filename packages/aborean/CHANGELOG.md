# @spectratools/aborean-cli

## 0.10.9

### Patch Changes

- [#452](https://github.com/spectra-the-bot/spectra-tools/pull/452) [`a448c2b`](https://github.com/spectra-the-bot/spectra-tools/commit/a448c2be9c83fa6f30ab2970a5840610593c7513) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add tokens list command alias and --limit flag to lending markets for backward compatibility.

## 0.10.8

### Patch Changes

- [#449](https://github.com/spectra-the-bot/spectra-tools/pull/449) [`4a1e9e6`](https://github.com/spectra-the-bot/spectra-tools/commit/4a1e9e62f0be8a426c6a7e4f7ce384679ec7d974) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add invocation smoke tests and import side-effect guards, and fix `cli.serve()` so it only runs when invoked as the CLI entrypoint.

## 0.10.7

### Patch Changes

- Updated dependencies [[`9ad215e`](https://github.com/spectra-the-bot/spectra-tools/commit/9ad215e8173a850da9412f48e42fb6eb9c54ec94)]:
  - @spectratools/cli-shared@0.4.1
  - @spectratools/tx-shared@0.6.2

## 0.10.6

### Patch Changes

- Updated dependencies [[`3602983`](https://github.com/spectra-the-bot/spectra-tools/commit/3602983c45c3d6c814e6e77f8773f33a2337bcdb)]:
  - @spectratools/tx-shared@0.6.1

## 0.10.5

### Patch Changes

- [#408](https://github.com/spectra-the-bot/spectra-tools/pull/408) [`69a82c3`](https://github.com/spectra-the-bot/spectra-tools/commit/69a82c35a6e4addc0047fd4081ca26b9455655e2) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add explicit exports map and build src/index.ts for stable package-root imports.

- [#412](https://github.com/spectra-the-bot/spectra-tools/pull/412) [`a1b9638`](https://github.com/spectra-the-bot/spectra-tools/commit/a1b9638bbd2ba0e1479721b934612b93eaa35101) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Wire OTEL telemetry initialization and root command spans across all CLI packages.

- Updated dependencies [[`58bed96`](https://github.com/spectra-the-bot/spectra-tools/commit/58bed96fd22615ae6654d630e2e4e5b15099089d), [`8f0c670`](https://github.com/spectra-the-bot/spectra-tools/commit/8f0c6707163c26bd1db88264ac217c7ee56007f5), [`a1b9638`](https://github.com/spectra-the-bot/spectra-tools/commit/a1b9638bbd2ba0e1479721b934612b93eaa35101)]:
  - @spectratools/cli-shared@0.4.0
  - @spectratools/tx-shared@0.6.0

## 0.10.4

### Patch Changes

- [#409](https://github.com/spectra-the-bot/spectra-tools/pull/409) [`63aeede`](https://github.com/spectra-the-bot/spectra-tools/commit/63aeede2ccb834415b728e888c081240394a4d61) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add `exports["."]` map to aborean-cli and assembly-cli package.json, and extend packed-artifact e2e test to validate package-root imports for all CLI packages with root exports.

- [#403](https://github.com/spectra-the-bot/spectra-tools/pull/403) [`5e22fc9`](https://github.com/spectra-the-bot/spectra-tools/commit/5e22fc97f0de47ed6a0ba03f628648843a520706) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix package-root import: dist/index.js was missing from published artifact because src/index.ts was not included in tsup entry points. Closes #401.

- Updated dependencies [[`152941a`](https://github.com/spectra-the-bot/spectra-tools/commit/152941a9a542bc33964e44f6ff9d253653fabdac)]:
  - @spectratools/cli-shared@0.3.0

## 0.10.3

### Patch Changes

- Updated dependencies [[`dad2a60`](https://github.com/spectra-the-bot/spectra-tools/commit/dad2a6071f23bbb75bd4028dfb2b79f8aa3c9dce)]:
  - @spectratools/cli-shared@0.2.1

## 0.10.2

### Patch Changes

- Updated dependencies [[`6f2d227`](https://github.com/spectra-the-bot/spectra-tools/commit/6f2d2272d310069f8cc936c22c3518d1f6e4ffcf)]:
  - @spectratools/cli-shared@0.2.0

## 0.10.1

### Patch Changes

- Updated dependencies [[`e5e4724`](https://github.com/spectra-the-bot/spectra-tools/commit/e5e47248d538c261e0fa8436bd1ba7c3f2807aaf)]:
  - @spectratools/cli-shared@0.1.2

## 0.10.0

### Minor Changes

- [#322](https://github.com/spectra-the-bot/spectra-tools/pull/322) [`e32c768`](https://github.com/spectra-the-bot/spectra-tools/commit/e32c76800b444fedb385509607e793a7e6527f00) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add gauges deposit/withdraw and voter vote write commands.

- [#323](https://github.com/spectra-the-bot/spectra-tools/pull/323) [`e577e4a`](https://github.com/spectra-the-bot/spectra-tools/commit/e577e4aa813db6c2f7424d4e6ee25240d39ab5cf) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add pools add/remove-liquidity and cl add/remove-position write commands.

## 0.9.0

### Minor Changes

- [#320](https://github.com/spectra-the-bot/spectra-tools/pull/320) [`06f9167`](https://github.com/spectra-the-bot/spectra-tools/commit/06f91679f22a8aafd10151d55ec354e3958cc31e) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add pools swap command for V2 AMM single-hop swap execution.

## 0.8.0

### Minor Changes

- [#319](https://github.com/spectra-the-bot/spectra-tools/pull/319) [`85b5969`](https://github.com/spectra-the-bot/spectra-tools/commit/85b596913d29ac7e0255b7852449ab405a628975) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add cl swap command for Slipstream single-hop swap execution.

- [#314](https://github.com/spectra-the-bot/spectra-tools/pull/314) [`d2f6d8c`](https://github.com/spectra-the-bot/spectra-tools/commit/d2f6d8c6785fdacf2ef85d303d76a27b906a576c) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add Aborean wallet/signer write-transaction foundations with PRIVATE_KEY resolution, dry-run handling, and write helper tests.

## 0.7.0

### Minor Changes

- [#239](https://github.com/spectra-the-bot/spectra-tools/pull/239) [`1adeaef`](https://github.com/spectra-the-bot/spectra-tools/commit/1adeaeff7afff3ce6a30d2450ab9419b59d7d2ae) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add CTA hints to all aborean command responses for better agent workflow chaining.

## 0.6.0

### Minor Changes

- [#183](https://github.com/spectra-the-bot/spectra-tools/pull/183) [`c9dd199`](https://github.com/spectra-the-bot/spectra-tools/commit/c9dd199da3f305045c236bab1cde34f9129365c5) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add vault and Morpho lending read commands and upgrade status with cross-protocol snapshots.

## 0.5.0

### Minor Changes

- [#180](https://github.com/spectra-the-bot/spectra-tools/pull/180) [`8e2e6d4`](https://github.com/spectra-the-bot/spectra-tools/commit/8e2e6d445523ce6265558a0b61d69caae776a99f) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add V2 pool read commands for listing pools, inspecting reserves/fees, and getting swap quotes.

## 0.4.0

### Minor Changes

- [#172](https://github.com/spectra-the-bot/spectra-tools/pull/172) [`9441da5`](https://github.com/spectra-the-bot/spectra-tools/commit/9441da530b4fbd626312559a3733ac6e9d4dae8a) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add Slipstream CL pool, position, and quote read commands to aborean-cli.

## 0.3.0

### Minor Changes

- [#171](https://github.com/spectra-the-bot/spectra-tools/pull/171) [`be05796`](https://github.com/spectra-the-bot/spectra-tools/commit/be057964e98a2f7393044f17d7c6a0a23b5dd150) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add gauge, voting-escrow, and voter read commands with multicall-backed list operations.

## 0.2.0

### Minor Changes

- [#160](https://github.com/spectra-the-bot/spectra-tools/pull/160) [`f9fb6ce`](https://github.com/spectra-the-bot/spectra-tools/commit/f9fb6ce56bbd8cb414c18cbcb0570ce5c0246ef0) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add aborean-cli package with scaffolding, contract addresses, and ABIs.
