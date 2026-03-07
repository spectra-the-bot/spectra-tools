# @spectra-the-bot/etherscan-cli

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
