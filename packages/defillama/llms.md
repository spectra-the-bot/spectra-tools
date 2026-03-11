# defillama-cli

Query DefiLlama API data from the command line. No API key required.

## Command Groups

### tvl — Total Value Locked

- `tvl protocols` — List protocols ranked by TVL. Options: `--chain`, `--limit`, `--sort (tvl|change_1d|change_7d)`.
- `tvl chains` — List chains ranked by TVL. Options: `--limit`.
- `tvl protocol <slug>` — Get detailed protocol info with TVL breakdown by chain.
- `tvl history <slug>` — Show historical TVL for a protocol. Options: `--days`, `--chain`.

### volume — DEX Trading Volume

- `volume dexs` — List DEXes ranked by trading volume. Options: `--chain`, `--limit`, `--sort (total24h|total7d|change_1d)`, `--category`.
- `volume protocol <slug>` — Get detailed volume data for a specific protocol.
- `volume aggregators` — List DEX aggregators ranked by volume. Options: `--chain`, `--limit`.

### fees — Protocol Fees & Revenue

- `fees overview` — List protocols ranked by fees. Options: `--chain`, `--limit`, `--sort (total24h|total7d|change_1d)`, `--category`.
- `fees protocol <slug>` — Get detailed fee data for a specific protocol.

### prices — Token Prices

- `prices current <coins>` — Get current prices. Options: `--search-width`.
- `prices historical <coins>` — Get prices at a point in time. Options: `--timestamp`, `--date`, `--search-width`.
- `prices chart <coins>` — Get a price chart over a time range. Options: `--start`, `--end`, `--span`, `--period`, `--search-width`.

Coin format: `chainName:0xAddress` (e.g. `ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7`).

## Common Usage Patterns

```bash
# Market overview: top protocols by TVL
defillama-cli tvl protocols --limit 10 --json

# Chain-specific analysis
defillama-cli tvl protocols --chain abstract --limit 10 --json
defillama-cli volume dexs --chain ethereum --limit 5 --json
defillama-cli fees overview --chain base --limit 5 --json

# Protocol deep-dive
defillama-cli tvl protocol aave --json
defillama-cli fees protocol aave --json
defillama-cli volume protocol uniswap --json

# Token price lookup
defillama-cli prices current ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7 --json

# Historical analysis
defillama-cli tvl history aave --days 30 --json
defillama-cli prices chart ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7 --start 2025-01-01 --period 1d --json
```

## Output Format

All commands support `--json` for structured JSON output. Default output is human-readable tables with formatted USD values (e.g. `$1.23B`) and percentage changes (e.g. `+12.34%`).

Run `defillama-cli --llms-full` for full manifest. Run `defillama-cli <command> --schema` for argument details.
