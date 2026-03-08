# 🏛️ Assembly CLI

**Monitor and query Assembly governance on Abstract** — proposals, council seats, treasury, forum discussions, and member activity.

Assembly CLI connects directly to Abstract's onchain Assembly contracts, giving you real-time visibility into governance operations from your terminal or any automated pipeline.

## Install

::: code-group

```bash [npx (no install)]
npx @spectratools/assembly-cli status
```

```bash [npm]
npm install -g @spectratools/assembly-cli
```

```bash [pnpm]
pnpm add -g @spectratools/assembly-cli
```

:::

## What you can do

### Governance

Track proposals, check vote participation, and monitor governance activity:

```bash
assembly-cli governance proposals --limit 5
assembly-cli governance proposal 42
assembly-cli status
```

### Members

Query member registrations, lookup activity, and list the registry:

```bash
assembly-cli members list --limit 20
assembly-cli members get 0x1234...
```

### Council

View council seats and auction slot status:

```bash
assembly-cli council seats
```

### Treasury

Check treasury balances and spending controls:

```bash
assembly-cli treasury balances
```

### Forum

Browse forum threads, comments, and petitions:

```bash
assembly-cli forum threads --limit 10
assembly-cli forum thread 5
```

## Configuration

Assembly CLI works out of the box — no API keys required. It connects to Abstract's public RPC by default.

| Variable | Required | Description |
|----------|----------|-------------|
| `ABSTRACT_RPC_URL` | No | Override the default RPC endpoint |
| `ASSEMBLY_INDEXER_URL` | No | Optional indexer for faster member queries |

## Use with agents

```bash
# Structured JSON output
assembly-cli governance proposals --limit 5 --json

# Full CLI manifest for agent discovery
assembly-cli --llms

# Register as an agent skill or MCP server
assembly-cli skills add
assembly-cli mcp add
```

## Reference

- [Command reference](/assembly/commands) — full list of commands with arguments and examples
- [Configuration](/configuration) — environment variables
- [Agent integration](/agent-integration) — discovery, schemas, and structured output
