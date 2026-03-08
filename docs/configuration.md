# Configuration

This page centralizes environment variables used across `@spectratools/*-cli` packages.

## Shared + package-specific variables

| Variable | Used by | Required | Purpose |
|---|---|---|---|
| `ABSTRACT_RPC_URL` | `assembly-cli`, `erc8004-cli` | No | Override Abstract RPC endpoint (defaults are provided by package clients). |
| `ASSEMBLY_INDEXER_URL` | `assembly-cli` | No | Optional member snapshot index for `members list`; falls back to onchain events if unavailable. |
| `ETHERSCAN_API_KEY` | `etherscan-cli` | Yes for Etherscan commands | API key for Etherscan V2 endpoints across account/contract/tx/token/gas/stats commands. |
| `X_BEARER_TOKEN` | `xapi-cli` | Required for read-only auth when `X_ACCESS_TOKEN` is absent | App bearer token for search/profile/timeline/list/trend reads. |
| `X_ACCESS_TOKEN` | `xapi-cli` | Required for write actions (`posts create`, `posts delete`, `dm send`) | OAuth 2.0 user-context token; also preferred for read requests when present. |
| `IDENTITY_REGISTRY_ADDRESS` | `erc8004-cli` | Optional override | ERC-8004 identity registry contract address (default: `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432`). |
| `REPUTATION_REGISTRY_ADDRESS` | `erc8004-cli` | Optional override | ERC-8004 reputation registry contract address (default: `0x8004baa17c55a88189ae136b182e5fda19de9b63`). |
| `VALIDATION_REGISTRY_ADDRESS` | `erc8004-cli` | Optional override | ERC-8004 validation registry contract address (default: `0x8004cc8439f36fd5f9f049d9ff86523df6daab58`). |
| `IPFS_GATEWAY` | `erc8004-cli` | No | Gateway for resolving `ipfs://` metadata (default: `https://ipfs.io`). |
| `PRIVATE_KEY` | `erc8004-cli` write operations | Required for write commands | `0x`-prefixed signing key for registration/reputation/validation transactions. |

## Example shell profile

```bash
# Abstract / onchain
export ABSTRACT_RPC_URL="https://api.mainnet.abs.xyz"
export ASSEMBLY_INDEXER_URL="https://assembly-indexer.example.com"

# Etherscan
export ETHERSCAN_API_KEY="your-etherscan-key"

# X API
export X_BEARER_TOKEN="your-x-bearer-token"
export X_ACCESS_TOKEN="your-x-access-token"

# ERC-8004
export IDENTITY_REGISTRY_ADDRESS="0x..."
export REPUTATION_REGISTRY_ADDRESS="0x..."
export VALIDATION_REGISTRY_ADDRESS="0x..."
export IPFS_GATEWAY="https://ipfs.io"
export PRIVATE_KEY="0x..."
```

## Security notes

- Prefer short-lived tokens when possible (`X_ACCESS_TOKEN`).
- Never commit API keys or private keys.
- For CI, store secrets in repository/org secret managers and inject at runtime.
