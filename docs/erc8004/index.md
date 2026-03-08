# 🤖 ERC-8004 CLI <Badge type="warning" text="preview" />

**Explore trustless agent identity, reputation, and validation on Abstract** — built on the [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) standard for onchain agent operations.

::: warning Experimental preview
ERC-8004 CLI is in early development. Some commands may not work as expected, and the API surface may change. Use it to explore the protocol, but don't rely on it for production workflows yet.
:::

## Install

::: code-group

```bash [npx (no install)]
npx @spectratools/erc8004-cli discovery search --service mcp --limit 5
```

```bash [npm]
npm install -g @spectratools/erc8004-cli
```

```bash [pnpm]
pnpm add -g @spectratools/erc8004-cli
```

:::

## What you can do

### Discovery

Search for registered agents and services:

```bash
erc8004-cli discovery search --service mcp --limit 10
```

### Identity

Query and manage agent identity registrations:

```bash
erc8004-cli identity get 0x1234...
erc8004-cli registration create --name "my-agent"
erc8004-cli registration file validate ./registration.json
```

### Reputation

Check agent reputation scores and feedback:

```bash
erc8004-cli reputation score 0x1234...
erc8004-cli reputation history 0x1234...
```

### Validation

Submit and check validation requests:

```bash
erc8004-cli validation status 0x1234...
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ABSTRACT_RPC_URL` | No | Override the default Abstract RPC endpoint |
| `PRIVATE_KEY` | For write commands | `0x`-prefixed signing key for transactions |
| `IDENTITY_REGISTRY_ADDRESS` | No | Override identity registry contract |
| `REPUTATION_REGISTRY_ADDRESS` | No | Override reputation registry contract |
| `VALIDATION_REGISTRY_ADDRESS` | No | Override validation registry contract |
| `IPFS_GATEWAY` | No | Gateway for `ipfs://` metadata (default: `https://ipfs.io`) |

## Use with agents

```bash
# Structured JSON output
erc8004-cli discovery search --service mcp --limit 5 --json

# Full CLI manifest for agent discovery
erc8004-cli --llms

# Register as an agent skill or MCP server
erc8004-cli skills add
erc8004-cli mcp add
```

## Reference

- [Command reference](/erc8004/commands) — full list of commands with arguments and examples
- [Configuration](/configuration) — environment variables
- [Agent integration](/agent-integration) — discovery, schemas, and structured output
