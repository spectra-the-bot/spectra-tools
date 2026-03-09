# Getting Started

Get up and running with spectra-tools in under a minute.

## Requirements

- [Node.js](https://nodejs.org/) 20 or later

## Quick start

The fastest way to try any CLI is with `npx` — no install needed:

```bash
npx @spectratools/assembly-cli status
```

You'll see a live snapshot of Abstract's Assembly governance state, right in your terminal.

## Install globally

If you use a CLI regularly, install it globally for faster access:

::: code-group

```bash [npm]
npm install -g @spectratools/assembly-cli
```

```bash [pnpm]
pnpm add -g @spectratools/assembly-cli
```

```bash [yarn]
yarn global add @spectratools/assembly-cli
```

:::

After installing, run commands directly:

```bash
assembly-cli status
```

## Choose your CLI

Each CLI focuses on a different domain. Install only what you need:

### 🏛️ Assembly CLI — Governance on Abstract

Monitor proposals, council activity, treasury, and forum discussions.

```bash
npx @spectratools/assembly-cli governance proposals --limit 5
npx @spectratools/assembly-cli treasury balances
npx @spectratools/assembly-cli members list --limit 10
```

→ [Assembly CLI docs](/assembly/)

### 🔍 Etherscan CLI — Multi-chain explorer data

Query balances, transactions, contracts, tokens, and gas across EVM chains.

```bash
npx @spectratools/etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum
npx @spectratools/etherscan-cli gas oracle --chain ethereum
npx @spectratools/etherscan-cli token info 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

Requires an [Etherscan API key](https://etherscan.io/myapikey). Set it as `ETHERSCAN_API_KEY`.

→ [Etherscan CLI docs](/etherscan/)

### 📡 X API CLI — X (Twitter) automation

Search posts, pull timelines, manage lists, and send DMs.

```bash
npx @spectratools/xapi-cli posts search "abstract chain" --limit 5
npx @spectratools/xapi-cli users profile abstractchain
npx @spectratools/xapi-cli timeline home --limit 10
```

Requires X API credentials. Set `X_BEARER_TOKEN` for read access or `X_ACCESS_TOKEN` for full access.

→ [X API CLI docs](/xapi/)

### 🤖 ERC-8004 CLI — Agent identity & reputation <Badge type="warning" text="preview" />

Explore trustless agent registries on Abstract. This CLI is in early preview — some commands may not work as expected.

```bash
npx @spectratools/erc8004-cli discovery search --service mcp --limit 5
```

→ [ERC-8004 CLI docs](/erc8004/)

## Configure API keys

Some CLIs need API keys or tokens. See the [Configuration guide](/configuration) for the full list, organized by CLI.

## Use with AI agents

All CLIs are built for agent consumption. Register any CLI as a skill or MCP server in one command:

```bash
assembly-cli skills add    # register as agent skill
assembly-cli mcp add       # register as MCP server
assembly-cli --llms        # compact command index for discovery
assembly-cli --llms-full   # full manifest with all details
```

→ [Agent integration guide](/agent-integration)
