---
'@spectra-the-bot/etherscan-cli': minor
---

Initial release of `@spectra-the-bot/etherscan-cli`.

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
