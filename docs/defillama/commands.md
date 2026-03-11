# Command Reference

## defillama tvl

Total value locked queries.

### defillama tvl protocols

List protocols ranked by TVL.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | | Filter protocols by chain name |
| `--limit` | `number` | `20` | Max protocols to display |
| `--sort` | `string` | `tvl` | Sort field: `tvl`, `change_1d`, or `change_7d` |

#### Examples

```bash
# Top 10 protocols by TVL
defillama-cli tvl protocols --limit 10

# Top protocols on Abstract
defillama-cli tvl protocols --chain abstract --limit 10

# Top 5 by 1-day change
defillama-cli tvl protocols --sort change_1d --limit 5
```

### defillama tvl chains

List chains ranked by TVL.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--limit` | `number` | `20` | Max chains to display |

#### Examples

```bash
# Top 10 chains by TVL
defillama-cli tvl chains --limit 10
```

### defillama tvl protocol

Get detailed protocol info with TVL breakdown by chain.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `slug` | `string` | yes | Protocol slug (e.g. `aave`, `uniswap`) |

#### Examples

```bash
# Aave protocol details
defillama-cli tvl protocol aave
```

### defillama tvl history

Show historical TVL for a protocol.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `slug` | `string` | yes | Protocol slug (e.g. `aave`, `uniswap`) |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--days` | `number` | `30` | Number of days of history to display |
| `--chain` | `string` | | Filter to a specific chain |

#### Examples

```bash
# Aave 7-day TVL history
defillama-cli tvl history aave --days 7

# Uniswap Ethereum chain TVL over 14 days
defillama-cli tvl history uniswap --days 14 --chain Ethereum
```

---

## defillama volume

DEX volume queries.

### defillama volume dexs

List DEXes ranked by trading volume.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | | Filter by chain name |
| `--limit` | `number` | `20` | Max protocols to display |
| `--sort` | `string` | `total24h` | Sort field: `total24h`, `total7d`, or `change_1d` |
| `--category` | `string` | | Filter by category (e.g. `Dexs`, `Prediction`) |

#### Examples

```bash
# Top 10 DEXes by 24h volume
defillama-cli volume dexs --limit 10

# Top DEXes on Abstract
defillama-cli volume dexs --chain abstract --limit 10

# Top 5 by 1-day volume change
defillama-cli volume dexs --sort change_1d --limit 5
```

### defillama volume protocol

Get detailed volume data for a specific protocol.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `slug` | `string` | yes | Protocol slug (e.g. `uniswap`, `curve-dex`) |

#### Examples

```bash
# Uniswap volume details
defillama-cli volume protocol uniswap
```

### defillama volume aggregators

List DEX aggregators ranked by trading volume.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | | Filter by chain name |
| `--limit` | `number` | `20` | Max aggregators to display |

#### Examples

```bash
# Top 10 DEX aggregators by volume
defillama-cli volume aggregators --limit 10

# Top 5 aggregators on Ethereum
defillama-cli volume aggregators --chain ethereum --limit 5
```

---

## defillama fees

Protocol fees and revenue queries.

### defillama fees overview

List protocols ranked by fees and revenue.

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | | Filter by chain name |
| `--limit` | `number` | `20` | Max protocols to display |
| `--sort` | `string` | `total24h` | Sort field: `total24h`, `total7d`, or `change_1d` |
| `--category` | `string` | | Filter by category (e.g. `Dexs`, `Lending`, `Bridge`) |

#### Examples

```bash
# Top 10 protocols by 24h fees
defillama-cli fees overview --limit 10

# Top protocols on Abstract by fees
defillama-cli fees overview --chain abstract --limit 10

# Top 10 DEXes by fees
defillama-cli fees overview --category Dexs --limit 10
```

### defillama fees protocol

Get detailed fee and revenue data for a specific protocol.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `slug` | `string` | yes | Protocol slug (e.g. `aave`, `lido`) |

#### Examples

```bash
# Aave fee details
defillama-cli fees protocol aave
```

---

## defillama prices

Token price queries via `coins.llama.fi`.

Coin identifiers use the format `chainName:0xAddress` (e.g. `ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7`).

### defillama prices current

Get current prices for one or more tokens.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `coins` | `string` | yes | Coin identifiers (`chainName:0xAddress`), comma-separated for multiple |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--search-width` | `string` | `4h` | Timestamp search width |

#### Examples

```bash
# Current price of USDT on Ethereum
defillama-cli prices current ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7
```

### defillama prices historical

Get token prices at a specific point in time.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `coins` | `string` | yes | Coin identifiers (`chainName:0xAddress`) |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--timestamp` | `string` | | Unix timestamp in seconds |
| `--date` | `string` | | ISO date string (e.g. `2025-01-01`) |
| `--search-width` | `string` | `4h` | Timestamp search width |

#### Examples

```bash
# USDT price on 2025-01-01
defillama-cli prices historical ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7 --date 2025-01-01
```

### defillama prices chart

Get a price chart over a time range.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `coins` | `string` | yes | Coin identifiers (`chainName:0xAddress`) |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--start` | `string` | | Start timestamp or ISO date |
| `--end` | `string` | | End timestamp or ISO date (default: now) |
| `--span` | `number` | | Number of data points |
| `--period` | `string` | | Data point period (e.g. `1d`, `1h`, `4h`) |
| `--search-width` | `string` | `4h` | Timestamp search width |

#### Examples

```bash
# USDT daily price chart since 2025-01-01
defillama-cli prices chart ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7 --start 2025-01-01 --period 1d
```

---

## Global Options

All commands support these built-in flags:

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `--llms` | Print LLM-readable command manifest |
| `--llms-full` | Print full LLM manifest |
| `--help` | Show help |
| `--version` | Show version |
| `--schema` | Show argument schema for a command |
