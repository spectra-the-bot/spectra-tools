# Configuration

Each CLI uses environment variables for API keys and optional service overrides. Set only what you need for the CLIs you use.

## Assembly CLI

Assembly CLI works out of the box with no required configuration — it connects to Abstract's public RPC.

| Variable | Required | Description |
|----------|----------|-------------|
| `ABSTRACT_RPC_URL` | No | Override the default Abstract RPC endpoint |
| `ASSEMBLY_INDEXER_URL` | No | Optional indexer for faster `members list` queries (falls back to onchain events) |

## Etherscan CLI

| Variable | Required | Description |
|----------|----------|-------------|
| `ETHERSCAN_API_KEY` | **Yes** | API key from [etherscan.io/myapikey](https://etherscan.io/myapikey). Works across all supported chains via Etherscan V2. |

```bash
export ETHERSCAN_API_KEY="your-etherscan-api-key"
```

## X API CLI

| Variable | Required | Description |
|----------|----------|-------------|
| `X_BEARER_TOKEN` | For read-only access | App bearer token for search, profiles, timelines, lists, and trends |
| `X_ACCESS_TOKEN` | For write access | OAuth 2.0 user token for creating/deleting posts and sending DMs. Also used for reads when set. |

```bash
# Read-only access
export X_BEARER_TOKEN="your-x-bearer-token"

# Full access (read + write)
export X_ACCESS_TOKEN="your-x-access-token"
```

::: tip
If both tokens are set, `X_ACCESS_TOKEN` is preferred for all requests.
:::

## ERC-8004 CLI <Badge type="warning" text="preview" />

| Variable | Required | Description |
|----------|----------|-------------|
| `ABSTRACT_RPC_URL` | No | Override the default Abstract RPC endpoint |
| `PRIVATE_KEY` | For write commands | `0x`-prefixed signing key for registration, reputation, and validation transactions |
| `IDENTITY_REGISTRY_ADDRESS` | No | Override the identity registry contract address |
| `REPUTATION_REGISTRY_ADDRESS` | No | Override the reputation registry contract address |
| `VALIDATION_REGISTRY_ADDRESS` | No | Override the validation registry contract address |
| `IPFS_GATEWAY` | No | Gateway for resolving `ipfs://` metadata (default: `https://ipfs.io`) |

## Security best practices

- **Never commit API keys or private keys** to version control
- Store secrets in environment variables or a secrets manager
- Prefer short-lived tokens when possible (especially `X_ACCESS_TOKEN`)
- For CI/CD, use your platform's secret management (GitHub Secrets, etc.)

## Full example

```bash
# ~/.bashrc or ~/.zshrc

# Assembly (optional overrides)
export ABSTRACT_RPC_URL="https://api.mainnet.abs.xyz"

# Etherscan
export ETHERSCAN_API_KEY="your-etherscan-key"

# X API
export X_BEARER_TOKEN="your-x-bearer-token"
export X_ACCESS_TOKEN="your-x-access-token"

# ERC-8004 (preview)
export PRIVATE_KEY="0x..."
```
