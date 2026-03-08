# 🔍 Etherscan CLI

**Query blockchain data across any EVM chain** — account balances, transactions, contracts, tokens, and gas estimates via Etherscan's V2 API.

One CLI, one API key, access to Ethereum, Abstract, Arbitrum, Optimism, Base, Polygon, and [every chain Etherscan V2 supports](https://docs.etherscan.io/etherscan-v2).

## Install

::: code-group

```bash [npx (no install)]
npx @spectratools/etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum
```

```bash [npm]
npm install -g @spectratools/etherscan-cli
```

```bash [pnpm]
pnpm add -g @spectratools/etherscan-cli
```

:::

## What you can do

### Account

Look up balances and transaction history for any address:

```bash
etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum
etherscan-cli account txs 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --limit 10
etherscan-cli account token-transfers 0x... --chain ethereum
```

### Contract

Fetch ABIs, source code, and deployment info for verified contracts:

```bash
etherscan-cli contract abi 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
etherscan-cli contract source 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
etherscan-cli contract creator 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

### Transaction

Look up transaction details, receipts, and execution status:

```bash
etherscan-cli tx info 0xabc123...
etherscan-cli tx receipt 0xabc123...
etherscan-cli tx status 0xabc123...
```

### Token

Get token metadata, holder snapshots, and supply data:

```bash
etherscan-cli token info 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
etherscan-cli token holders 0x... --chain ethereum
etherscan-cli token supply 0x... --chain ethereum
```

### Gas

Check current gas prices and estimate confirmation times:

```bash
etherscan-cli gas oracle --chain ethereum
etherscan-cli gas estimate 20000000000 --chain ethereum
```

### Stats

Get ETH price and supply data:

```bash
etherscan-cli stats price --chain ethereum
etherscan-cli stats supply --chain ethereum
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ETHERSCAN_API_KEY` | **Yes** | API key from [etherscan.io/myapikey](https://etherscan.io/myapikey) |

```bash
export ETHERSCAN_API_KEY="your-etherscan-api-key"
```

## Use with agents

```bash
# Structured JSON output
etherscan-cli account balance 0x... --chain ethereum --json

# Full CLI manifest for agent discovery
etherscan-cli --llms

# Register as an agent skill or MCP server
etherscan-cli skills add
etherscan-cli mcp add
```

## Reference

- [Command reference](/etherscan/commands) — full list of commands with arguments and examples
- [Configuration](/configuration) — environment variables
- [Agent integration](/agent-integration) — discovery, schemas, and structured output
