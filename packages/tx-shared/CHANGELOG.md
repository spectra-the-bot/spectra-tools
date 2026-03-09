# @spectratools/tx-shared

## 0.5.0

### Minor Changes

- [#217](https://github.com/spectra-the-bot/spectra-tools/pull/217) [`5a9f8dc`](https://github.com/spectra-the-bot/spectra-tools/commit/5a9f8dcf5966606107b98aa12a797095c532e757) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add Privy-backed personal_sign, eth_signTypedData_v4, and eth_signTransaction account support.

## 0.4.3

### Patch Changes

- [#207](https://github.com/spectra-the-bot/spectra-tools/pull/207) [`c1a5268`](https://github.com/spectra-the-bot/spectra-tools/commit/c1a5268bfc07aab756501ba59d2899d298f937f3) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Implement a Privy-backed tx signer account that resolves wallet address and submits eth_sendTransaction intents with deterministic error mapping.

## 0.4.2

### Patch Changes

- [#201](https://github.com/spectra-the-bot/spectra-tools/pull/201) [`eb5cd26`](https://github.com/spectra-the-bot/spectra-tools/commit/eb5cd267799b69521cbf364a792b1de1f9b06e8d) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add Privy intent transport and authorization-signature primitives with strict config validation and deterministic tx error mapping.

- [#205](https://github.com/spectra-the-bot/spectra-tools/pull/205) [`e750281`](https://github.com/spectra-the-bot/spectra-tools/commit/e750281e12ecd4ed695f73a956afa3285ad134e8) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Document CI ETARGET regression guardrails and branch protection requirements for safer merges.

## 0.4.1

### Patch Changes

- [#189](https://github.com/spectra-the-bot/spectra-tools/pull/189) [`44331aa`](https://github.com/spectra-the-bot/spectra-tools/commit/44331aadf5501e5e75c1af2a3d6228ea68655f6c) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Document tx-shared signer providers and transaction lifecycle with assembly integration examples.

## 0.4.0

### Minor Changes

- [#179](https://github.com/spectra-the-bot/spectra-tools/pull/179) [`68bb9f8`](https://github.com/spectra-the-bot/spectra-tools/commit/68bb9f8dda5b69eb3ded30752128c5c7f95d9c85) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add resolveSigner provider precedence with shared signer flag/env schemas and deterministic Privy auth failures.

## 0.3.0

### Minor Changes

- [#132](https://github.com/spectra-the-bot/spectra-tools/pull/132) [`5d14b3b`](https://github.com/spectra-the-bot/spectra-tools/commit/5d14b3b7697da41a5adf84958ce6d36957e6ab70) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add executeTx lifecycle (estimate/simulate/submit/receipt) with structured error mapping and dry-run support.

- [#144](https://github.com/spectra-the-bot/spectra-tools/pull/144) [`c1adf36`](https://github.com/spectra-the-bot/spectra-tools/commit/c1adf36d174cbc827e167d4e7917432b916fc250) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add private-key and keystore signer adapters with structured error mapping.

## 0.2.0

### Minor Changes

- [#128](https://github.com/spectra-the-bot/spectra-tools/pull/128) [`fcea1c8`](https://github.com/spectra-the-bot/spectra-tools/commit/fcea1c885069a6d9210d9f0d9e5fafdbdf9fcefa) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Scaffold a new tx-shared package with signer types, tx error primitives, and Abstract chain client helpers.

## 0.1.0

### Minor Changes

- Initial scaffolding for shared transaction types, errors, and Abstract chain client primitives.
