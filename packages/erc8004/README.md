# @spectra-the-bot/erc8004-cli

CLI for ERC-8004 (Trustless Agents) registry interactions on Abstract mainnet. Built on [incur](https://github.com/wevm/incur).

## Overview

ERC-8004 defines three on-chain registries for AI agents:

- **Identity Registry** - Agent registration (ERC-721), each token points to a registration file
- **Reputation Registry** - Feedback signals between agents (scores, tags)
- **Validation Registry** - Independent validator checks and results

## Installation

```sh
pnpm add -g @spectra-the-bot/erc8004-cli
```

## Configuration

Set environment variables before running commands:

| Variable | Required | Description |
|---|---|---|
| `IDENTITY_REGISTRY_ADDRESS` | Read/write ops | Identity registry contract address |
| `REPUTATION_REGISTRY_ADDRESS` | Reputation ops | Reputation registry contract address |
| `VALIDATION_REGISTRY_ADDRESS` | Validation ops | Validation registry contract address |
| `ABSTRACT_RPC_URL` | No | RPC URL (defaults to `https://api.mainnet.abs.xyz`) |
| `PRIVATE_KEY` | Write ops | `0x`-prefixed private key for signing transactions |

## Commands

### Identity

```sh
# List all registered agents
erc8004 identity list [--owner <address>] [--limit 50]

# Get a specific agent
erc8004 identity get <agentId>

# Register a new agent (requires PRIVATE_KEY)
erc8004 identity register --uri <uri>

# Update an agent's registration URI (requires PRIVATE_KEY)
erc8004 identity update <agentId> --uri <newUri>

# Read agent metadata
erc8004 identity metadata <agentId> --key <key>

# Get agent wallet
erc8004 identity wallet <agentId>

# Set agent wallet (requires PRIVATE_KEY)
erc8004 identity set-wallet <agentId> --wallet <address> --signature <sig>
```

### Registration Files

Registration files are JSON documents pointed to by an agent's `tokenURI`.

```sh
# Fetch and parse an agent's registration file
erc8004 registration fetch <agentId>

# Validate a registration file at any URI (HTTPS, IPFS, data:)
erc8004 registration validate <uri>

# Generate a new registration file
erc8004 registration create --name "My Agent" [--description "..."] [--version "1.0.0"]
```

**Registration file format:**

```json
{
  "name": "My Agent",
  "description": "An AI agent for ...",
  "version": "1.0.0",
  "services": [
    {
      "id": "mcp-server",
      "type": "mcp",
      "url": "https://mcp.example.com",
      "auth": { "type": "bearer" }
    }
  ],
  "capabilities": ["code-review", "data-analysis"],
  "erc8004": { "version": "0.1.0" }
}
```

### Reputation

```sh
# Get reputation score for an agent
erc8004 reputation get <agentId>

# Submit feedback (requires PRIVATE_KEY)
erc8004 reputation feedback <agentId> --value <int128> [--tag1 <str>] [--tag2 <str>] [--file-uri <uri>]

# View feedback history
erc8004 reputation history <agentId> [--limit 50]
```

Feedback values are `int128`: positive values indicate good experiences, negative indicate problems.

### Validation

```sh
# Request a validation (requires PRIVATE_KEY)
erc8004 validation request <agentId> --validator <address> --job-hash <bytes32>

# Check validation status
erc8004 validation status <requestId>

# View validation history for an agent
erc8004 validation history <agentId>
```

Validation statuses: `Pending`, `Passed`, `Failed`, `Cancelled`.

### Discovery

```sh
# Search agents by name or service type
erc8004 discovery search [--name <query>] [--service <type>] [--limit 20]

# Resolve a full agent identifier
erc8004 discovery resolve <registryAddress>:<agentId>
```

## Agent Mode

All commands support structured JSON output for AI agent consumption:

```sh
erc8004 identity list --json
erc8004 identity get 1 --format json
```

## MCP Server

Run as an MCP server for direct agent integration:

```sh
erc8004 --mcp
# or register with Claude Code:
erc8004 mcp add
```

## Chain Info

- **Network**: Abstract mainnet (`chainId: 2741`)
- **RPC**: `https://api.mainnet.abs.xyz`
- **Explorer**: `https://abscan.org`
