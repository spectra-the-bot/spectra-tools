# @spectratools/erc8004-cli

> ⚠️ **Pre-release** — This package is under active development. Some commands may not work as expected. See [open issues](https://github.com/spectra-the-bot/spectra-tools/issues?q=is%3Aissue+is%3Aopen+erc8004) for known limitations.

CLI for ERC-8004 (Trustless Agents) identity, registration, reputation, validation, and discovery on Abstract.

## Install

```bash
pnpm add -g @spectratools/erc8004-cli
```

## LLM / Agent Discovery

```bash
# Emit machine-readable command metadata
erc8004-cli --llms

# Register as a reusable local skill for agent runtimes
erc8004-cli skills add

# Register as an MCP server entry
erc8004-cli mcp add
```

## Configuration

| Variable | Required | Description |
|---|---|---|
| `ABSTRACT_RPC_URL` | No | RPC URL override (defaults to package client default) |
| `IDENTITY_REGISTRY_ADDRESS` | Optional override | Identity registry contract |
| `REPUTATION_REGISTRY_ADDRESS` | Optional override | Reputation registry contract |
| `VALIDATION_REGISTRY_ADDRESS` | Optional override | Validation registry contract |
| `IPFS_GATEWAY` | No | IPFS HTTP gateway for resolving `ipfs://` URIs (defaults to `https://ipfs.io`) |
| `PRIVATE_KEY` | Write commands only | `0x`-prefixed signing key |

## Command Group Intent Summary

- `identity` — Register agents, inspect owner/URI/wallet, update metadata pointers
- `registration` — Fetch, validate, or generate ERC-8004 registration files
- `reputation` — Read score, submit feedback, inspect feedback history
- `validation` — Request/track validator workflows and outcomes
- `discovery` — Search for agents by metadata/services and resolve `<registry>:<agentId>`

## Agent-Oriented Examples

```bash
# 1) Discover MCP-capable agents for tool routing
erc8004-cli discovery search --service mcp --limit 10 --format json

# 2) Resolve a canonical agent identifier from memory
erc8004-cli discovery resolve 0xRegistryAddress:42 --format json

# 3) Pull identity + registration for trust checks
erc8004-cli identity get 42 --format json
erc8004-cli registration fetch 42 --format json

# 4) Compute quality heuristics from reputation history
erc8004-cli reputation get 42 --format json
erc8004-cli reputation history 42 --limit 20 --format json

# 5) Watch validation pipeline state
erc8004-cli validation status 9 --format json
```

## Common Workflows

```bash
# Register a new agent (write)
erc8004-cli identity register --uri ipfs://bafy... --format json

# Update URI (write)
erc8004-cli identity update 42 --uri ipfs://bafy... --format json

# Submit feedback (write)
erc8004-cli reputation feedback 42 --value 10 --tag1 accuracy --format json
```

## Network

- Chain: Abstract mainnet (`2741`)