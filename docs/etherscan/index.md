# 🔍 Etherscan CLI

**Query Etherscan V2 data across multiple EVM chains** — accounts, contracts, transactions, tokens, gas, and stats from one command-line tool.

`@spectratools/etherscan-cli` helps you pull explorer data for automations, dashboards, and incident triage using six command groups:

- `account`
- `contract`
- `tx`
- `token`
- `gas`
- `stats`

::: warning Default chain behavior
Etherscan CLI defaults to **Abstract** (`--chain abstract`).

If you want Ethereum mainnet, pass:

```bash
--chain ethereum
```
:::

## Install

::: code-group

```bash [npm]
npm install -g @spectratools/etherscan-cli
```

```bash [pnpm]
pnpm add -g @spectratools/etherscan-cli
```

```bash [npx (no install)]
npx @spectratools/etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum
```

:::

## Quick examples

```bash
# 1) Account balance
etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum

# 2) Contract ABI
etherscan-cli contract abi 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum

# 3) Gas oracle
etherscan-cli gas oracle --chain ethereum

# 4) Token metadata
etherscan-cli token info 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum

# 5) Transaction receipt
etherscan-cli tx receipt 0x1234...abcd --chain ethereum
```

## Required setup

```bash
export ETHERSCAN_API_KEY="your-etherscan-api-key"
```

## Reference and guides

- [Configuration](/etherscan/configuration) — API key, chains, and output modes
- [Command reference](/etherscan/commands) — full command list with arguments and examples
- [Guide: Contract Investigation](/etherscan/guides/contract-investigation)
- [Guide: Agent Integration](/etherscan/guides/agent-integration)
