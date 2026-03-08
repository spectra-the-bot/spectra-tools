# 🤖 ERC-8004 CLI <Badge type="warning" text="preview" />

`@spectratools/erc8004-cli` is a command-line interface for working with **ERC-8004 agent identity** on the **Abstract** chain.

It supports:

- **Identity** lookups (owner, URI, metadata, wallet)
- **Discovery** and identifier resolution (`<registry>:<agentId>`)
- **Reputation** reads/writes
- **Validation** request/status/history flows

::: warning Experimental preview
ERC-8004 support is still experimental. Commands and behavior may evolve as registry implementations and tooling mature.
:::

## Install

::: code-group

```bash [npx (no install)]
npx @spectratools/erc8004-cli identity get 634
```

```bash [npm]
npm install -g @spectratools/erc8004-cli
```

```bash [pnpm]
pnpm add -g @spectratools/erc8004-cli
```

:::

## Quick examples

```bash
# Get a specific identity
erc8004-cli identity get 634

# List identities by owner
erc8004-cli identity list --owner 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --limit 20

# Resolve canonical agent identifier
erc8004-cli discovery resolve 0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:634
```

## Important notes

- Some registries do not implement ERC-721 enumeration; unfiltered listing can return `ENUMERATION_UNSUPPORTED`.
- ⚠️ `reputation` and `validation` commands may return errors/reverts for agents without initialized reputation/validation data.

## Use with AI agents

```bash
# Structured output for automation
erc8004-cli discovery search --service mcp --limit 5 --json

# Emit machine-readable command manifest
erc8004-cli --llms

# Register as local skills / MCP entry
erc8004-cli skills add
erc8004-cli mcp add
```

## Reference

- [Configuration](/erc8004/configuration)
- [Agent discovery guide](/erc8004/guides/agent-discovery)
- [Agent integration guide](/erc8004/guides/agent-integration)
- [Command reference](/erc8004/commands)
