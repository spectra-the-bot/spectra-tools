# Guide: Agent Integration

`etherscan-cli` works well in agent pipelines because it supports discovery, schemas, structured output, and direct skill/MCP registration.

## Discover command capabilities

```bash
# Compact command index
etherscan-cli --llms

# Full machine-readable manifest
etherscan-cli --llms-full

# JSON schema for specific commands
etherscan-cli account balance --schema
etherscan-cli tx receipt --schema
```

## Run in structured mode

Use JSON for deterministic parsing:

```bash
etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --format json
```

For orchestration metadata, add `--verbose`:

```bash
etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --format json --verbose
```

## Control context size for LLMs

Filter output fields:

```bash
etherscan-cli token info 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum --format json --filter-output "symbol,totalSupply,priceUsd"
```

Use token-based pagination:

```bash
etherscan-cli account txlist 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --format json --token-limit 1500
etherscan-cli account txlist 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --format json --token-limit 1500 --token-offset 1500
```

## Register with agent runtimes

```bash
# Local skill registration
etherscan-cli skills add

# MCP registration
etherscan-cli mcp add
```

## Recommended pipeline

```text
1. Discover  -> etherscan-cli --llms (or --llms-full for details)
2. Validate  -> etherscan-cli <command> --schema
3. Execute   -> etherscan-cli <command> --format json
4. Constrain -> --filter-output / --token-limit
5. Route     -> send parsed output to planner/memory/tool router
```

## Important defaults

- `ETHERSCAN_API_KEY` is required
- default chain is `abstract`
- use `--chain ethereum` for Ethereum mainnet
