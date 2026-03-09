---
"@spectratools/erc8004-cli": minor
---

Add `identity set-metadata` and `identity transfer` commands.

- `identity set-metadata <agentId> --key <key> --value <value>`: Write a metadata key-value pair on an agent identity (requires signer).
- `identity transfer <agentId> --to <address>`: Transfer an agent identity token to a new owner via `safeTransferFrom` (default) or `transferFrom` (`--no-safe`). Includes ownership pre-check and zero-address guard.
- ABI additions: `transferFrom`, `safeTransferFrom`, `approve`, `getApproved`, `setApprovalForAll`, `isApprovedForAll` (standard ERC-721 functions).
