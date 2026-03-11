# RFC-001: DefiLlama CLI (`@spectratools/defillama-cli`)

**Status:** Implemented  
**Issue:** #357  
**Created:** 2026-03-10 (retrospective)

## Problem

Agent workflows needed reliable, structured access to DeFi protocol data (TVL, trading volume, fees, token prices) without depending on large raw API payloads that are frequently truncated in `web_fetch` responses at ~50KB.

This made it hard to:

- Rank protocols/chains by TVL or volume in a deterministic way
- Retrieve protocol-level snapshots with normalized output formatting
- Fetch token prices at current/historical timestamps for agent decision loops
- Compose repeatable CLI calls that fit cleanly into automation and scripting

## Implemented Solution

Implemented `@spectratools/defillama-cli` as an incur-based CLI package with command groups for TVL, volume, fees, and prices.

### Command surface implemented

```bash
defillama tvl protocols [--chain <name>] [--limit <n>] [--sort tvl|change_1d|change_7d]
defillama tvl chains [--limit <n>]
defillama tvl protocol <slug>
defillama tvl history <slug> [--days <n>] [--chain <name>]

defillama volume dexs [--chain <name>] [--limit <n>] [--sort total24h|total7d|change_1d] [--category <name>]
defillama volume protocol <slug>
defillama volume aggregators [--chain <name>] [--limit <n>]

defillama fees overview [--chain <name>] [--limit <n>] [--sort total24h|total7d|change_1d] [--category <name>]
defillama fees protocol <slug>

defillama prices current <chain:0xAddress...> [--search-width <window>]
defillama prices historical <chain:0xAddress...> [--timestamp <unix> | --date <iso>] [--search-width <window>]
defillama prices chart <chain:0xAddress...> [--start <time>] [--end <time>] [--span <n>] [--period <window>] [--search-width <window>]
```

### What was delivered

- **Protocols + TVL workflows:** ranked protocol and chain views, protocol detail, and TVL history
- **Volume workflows:** DEX rankings, per-protocol detail, and aggregator rankings
- **Fees workflows:** fee/revenue overviews and per-protocol detail
- **Prices workflows:** current prices, historical point-in-time prices, and chart series

## Outcome

`@spectratools/defillama-cli` shipped and is used as the structured interface for DefiLlama data in agent workflows.

## Status

Implemented in `@spectratools/defillama-cli` (epic #357).
