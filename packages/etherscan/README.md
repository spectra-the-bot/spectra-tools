# @spectratools/etherscan-cli

Etherscan V2 API CLI for multi-chain explorer automation.

## Install

```bash
pnpm add -g @spectratools/etherscan-cli
```

## LLM / Agent Discovery

```bash
# Emit machine-readable command metadata
etherscan-cli --llms

# Register as a reusable local skill for agent runtimes
etherscan-cli skills add

# Register as an MCP server entry
etherscan-cli mcp add
```

## ⚠️ Default Chain: Abstract

All commands default to the **Abstract** chain (`--chain abstract`) when no `--chain` flag is provided. If you are querying Ethereum mainnet, you must explicitly pass `--chain ethereum`:

```bash
# Queries Abstract (default)
etherscan-cli account balance 0x...

# Queries Ethereum mainnet (explicit)
etherscan-cli account balance 0x... --chain ethereum
```

Supported chains: `abstract`, `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `avalanche`, `bsc`, `linea`, `scroll`, `zksync`, `mantle`, `blast`, `mode`, `sepolia`, `goerli`.

## Configuration

```bash
export ETHERSCAN_API_KEY=your_api_key
```

## Command Group Intent Summary

- `account` — Wallet balances, normal/internal tx history, ERC-20/ERC-721/ERC-1155 transfers
- `contract` — ABI, verified source, and deployment transaction metadata
- `tx` — Transaction detail, receipt, and pass/fail status checks
- `token` — Token metadata, holder distribution, and supply
- `gas` — Current gas oracle and time-to-confirmation estimates
- `stats` — ETH price and supply snapshots
- `logs` — Event log queries with address/topic/block filters

## Agent-Oriented Examples

```bash
# 1) Wallet risk scan: balance + recent txs
etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --format json
etherscan-cli account txlist 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --sort desc --offset 20 --format json
etherscan-cli account internaltx 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --sort desc --offset 20 --format json

# 2) NFT transfer monitoring
etherscan-cli account nfttx 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --sort desc --offset 20 --format json
etherscan-cli account erc1155tx 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --sort desc --offset 20 --format json

# 3) Contract triage for unknown addresses
etherscan-cli contract creation 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum --format json
etherscan-cli contract source 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum --format json

# 4) Tx execution diagnosis
etherscan-cli tx info 0x1234...abcd --chain abstract --format json
etherscan-cli tx receipt 0x1234...abcd --chain abstract --format json

# 5) Token monitoring loop
etherscan-cli token info 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum --format json
etherscan-cli token holders 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --offset 25 --chain ethereum --format json

# 6) Event log indexing
etherscan-cli logs get --chain ethereum --address 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --topic0 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55aebec6f6f3c --fromblock 20000000 --toblock latest --offset 25 --format json

# 7) Gas-aware scheduling
etherscan-cli gas oracle --chain abstract --format json
etherscan-cli gas estimate --gasprice 1000000000 --chain abstract --format json
```

## Output Mode

Use `--format json` for agent pipelines and tool-calling flows.
