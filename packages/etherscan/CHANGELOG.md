# @spectra-the-bot/etherscan-cli

## 0.2.2

### Patch Changes

- [#161](https://github.com/spectra-the-bot/spectra-tools/pull/161) [`adde6e2`](https://github.com/spectra-the-bot/spectra-tools/commit/adde6e28d753a18c50047cdca3c0a19aa193c644) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Document default chain (Abstract) in README and help output.

## 0.2.1

### Patch Changes

- [#147](https://github.com/spectra-the-bot/spectra-tools/pull/147) [`8172cdd`](https://github.com/spectra-the-bot/spectra-tools/commit/8172cdd5c397cac8f0c06769c16e86f0f26ffadb) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Remove CTA objects from JSON output across etherscan, xapi, and erc8004 CLIs.

- [#146](https://github.com/spectra-the-bot/spectra-tools/pull/146) [`1fd0020`](https://github.com/spectra-the-bot/spectra-tools/commit/1fd002049b943f0925b752fbc130885215477f03) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add address validation before API calls to return structured errors for invalid addresses.

- [#145](https://github.com/spectra-the-bot/spectra-tools/pull/145) [`8b2924d`](https://github.com/spectra-the-bot/spectra-tools/commit/8b2924dae4fc22b42158f44bdb1761961f75bac6) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix tx status command schema mismatch with Etherscan V2 API response.

- [#158](https://github.com/spectra-the-bot/spectra-tools/pull/158) [`a3b3594`](https://github.com/spectra-the-bot/spectra-tools/commit/a3b359464c6d06483fd74af8593d1ee881cf4e27) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Decode hex values to decimal strings in tx info and receipt output.

- [#143](https://github.com/spectra-the-bot/spectra-tools/pull/143) [`0fb568f`](https://github.com/spectra-the-bot/spectra-tools/commit/0fb568f3d2241f30a4f1beec4ad60972e31fb327) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix --version flag to print version number instead of help text.

## 0.2.0

### Minor Changes

- [#119](https://github.com/spectra-the-bot/spectra-tools/pull/119) [`94dd56a`](https://github.com/spectra-the-bot/spectra-tools/commit/94dd56a4267e1a66c1f5089f804d4a5a5d016e16) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add end-to-end invocation tests for symlink, npx, and pack+install workflows across all CLI packages.

## 0.1.2

### Patch Changes

- [#92](https://github.com/spectra-the-bot/spectra-tools/pull/92) [`b85c533`](https://github.com/spectra-the-bot/spectra-tools/commit/b85c533dc47ac8885aae2ad1f77fb7ae9ab03b67) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Fix CLI entrypoint main-module detection to resolve symlinks before comparison. This restores npm/npx/bin invocations that run through `node_modules/.bin` symlinks instead of direct file paths.

## 0.1.0

### Minor Changes

- [#2](https://github.com/spectra-the-bot/spectra-tools/pull/2) [`3059a2e`](https://github.com/spectra-the-bot/spectra-tools/commit/3059a2e4ffee7e33b8eba650a89aaf4603674524) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Initial release of `@spectra-the-bot/etherscan-cli`.

  Full Etherscan V2 API CLI supporting 60+ chains including Abstract (2741).

  Commands:

  - `account balance` / `txlist` / `tokentx` / `tokenbalance`
  - `contract abi` / `source` / `creation`
  - `tx info` / `receipt` / `status`
  - `token info` / `holders` / `supply`
  - `gas oracle` / `estimate`
  - `stats ethprice` / `ethsupply`

  Features:

  - Default chain: Abstract (2741)
  - Token-bucket rate limiting (5 req/s)
  - Wei-to-ETH formatting and EIP-55 address checksumming
  - CTA suggestions for natural command chaining
  - JSON output via `--json` flag

### Patch Changes

- Updated dependencies [[`348e9d6`](https://github.com/spectra-the-bot/spectra-tools/commit/348e9d63aa509e6d5aeb11721b54a6619a69979c)]:
  - @spectra-the-bot/cli-shared@0.1.0
