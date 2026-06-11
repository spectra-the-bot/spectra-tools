# @spectratools/debank-cli

## 0.2.0

### Minor Changes

- [#484](https://github.com/spectra-the-bot/spectra-tools/pull/484) [`1f91f59`](https://github.com/spectra-the-bot/spectra-tools/commit/1f91f59034780dff64d36114facdc5ca4868d9e2) Thanks [@spectra-the-bot](https://github.com/spectra-the-bot)! - Add `@spectratools/debank-cli` — a DeBank Pro API CLI for blockchain and DeFi data. Wraps chains, protocols, tokens, pools, wallet portfolios (balances, tokens, NFTs, positions, history, net-worth curve, token/NFT approvals), NFT collections, and read-only wallet utilities (gas market, transaction explanation, and pre-execution simulation). Authenticates via the `ACCESS_KEY` header against `pro-openapi.debank.com`, with client-side pagination, transient-failure retries, and structured error codes. Commands carry documented Zod output schemas (chain, protocol, token, pagination envelope) sourced from the official DeBank reference, so `--schema` and `skills add` emit rich, field-level agent documentation.
