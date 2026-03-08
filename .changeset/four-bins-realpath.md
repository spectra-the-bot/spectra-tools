---
"@spectratools/assembly-cli": patch
"@spectratools/etherscan-cli": patch
"@spectratools/xapi-cli": patch
"@spectratools/erc8004-cli": patch
---

Fix CLI entrypoint main-module detection to resolve symlinks before comparison. This restores npm/npx/bin invocations that run through `node_modules/.bin` symlinks instead of direct file paths.
