# @spectratools/defillama-cli

Query DefiLlama API data from the command line — TVL, volume, fees, and token prices.

## Install

```bash
pnpm add -g @spectratools/defillama-cli
```

## LLM / Agent Discovery

```bash
# Emit machine-readable command metadata
defillama-cli --llms

# Register as a reusable local skill for agent runtimes
defillama-cli skills add

# Register as an MCP server entry
defillama-cli mcp add
```

## Quick Start

No API key required — DefiLlama is a free, public API.

```bash
# Top 10 protocols by TVL
defillama-cli tvl protocols --limit 10

# Top chains by TVL
defillama-cli tvl chains --limit 10

# Protocol detail with chain breakdown
defillama-cli tvl protocol aave

# TVL history for a protocol
defillama-cli tvl history aave --days 7

# Top DEXes by 24h volume
defillama-cli volume dexs --limit 10

# Volume for a specific DEX
defillama-cli volume protocol uniswap

# DEX aggregators ranked by volume
defillama-cli volume aggregators --limit 10

# Top protocols by fees
defillama-cli fees overview --limit 10

# Fee detail for a protocol
defillama-cli fees protocol aave

# Current token price
defillama-cli prices current ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7

# Historical token price
defillama-cli prices historical ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7 --date 2025-01-01

# Price chart
defillama-cli prices chart ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7 --start 2025-01-01 --period 1d
```

## Command Groups

| Group | Description |
|-------|-------------|
| `tvl` | Total value locked — protocols, chains, protocol detail, history |
| `volume` | DEX trading volume — dexs, protocol detail, aggregators |
| `fees` | Protocol fees and revenue — overview, protocol detail |
| `prices` | Token prices — current, historical, chart |

## Chain Filtering

Several commands support `--chain` to filter by blockchain:

```bash
defillama-cli tvl protocols --chain ethereum --limit 10
defillama-cli volume dexs --chain abstract --limit 10
defillama-cli fees overview --chain base --limit 10
```

## Output Modes

```bash
# Human-readable table output (default)
defillama-cli tvl protocols --limit 5

# JSON output for pipelines
defillama-cli tvl protocols --limit 5 --json
```

## Documentation

Full documentation: [spectratools.dev/defillama](https://spectratools.dev/defillama/)

## License

MIT
