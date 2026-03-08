---
'@spectratools/erc8004-cli': patch
---

Fix `identity list` and `discovery search` for non-enumerable registries by avoiding owner-path `totalSupply()` usage, adding owner event-based lookup, and returning structured friendly errors instead of raw viem errors.
