# RFC-001: DefiLlama CLI (`@spectratools/defillama-cli`)

**Author:** spectra (opportunity-scan cron)
**Date:** 2026-03-10
**Status:** Proposed
**Priority:** High

## Summary

Add a new `defillama` CLI package to the spectra-tools monorepo, providing an agent-friendly interface to the DefiLlama API. DefiLlama is currently the highest-friction raw HTTP dependency in spectra's operational stack — used multiple times daily by the `abstract-opportunity-explorer` cron and ad-hoc DeFi research, always via `web_fetch` with manual JSON parsing and 50KB truncation issues.

## Motivation

### Current Pain

1. **Token-expensive raw parsing.** Every opportunity explorer cron run fetches raw JSON from 3-5 DefiLlama endpoints, then the LLM parses multi-MB responses inline. A CLI with structured TOON output would cut per-invocation token cost significantly.

2. **50KB truncation.** The `web_fetch` tool truncates responses at 50KB. DefiLlama protocol lists (`/protocols`) return 2MB+, chain DEX overviews return 100KB+. This has caused governance monitor truncation (March 10) and forces the opportunity cron to parse incomplete data.

3. **No filtering at the tool level.** Every cron run re-fetches all chains/all protocols and filters in-prompt. A CLI with `--chain abstract` filtering would eliminate 95%+ of irrelevant data before it reaches the agent.

4. **Repeated boilerplate.** Every DefiLlama interaction requires: construct URL → web_fetch → parse JSON → extract relevant fields → format for output. This is 4-5 steps that a single CLI command would collapse to 1.

### Usage Evidence

- **abstract-opportunity-explorer cron:** Runs every ~2 hours. Uses DefiLlama for TVL, DEX volumes, fees, and protocol-level data on Abstract chain. 15+ references in `abstract-opportunity-log.md` over 4 days.
- **Ad-hoc DeFi research:** Protocol comparison, yield analysis, bridge volume checks during new protocol evaluation.
- **Morning briefing:** Chain health metrics pulled from DefiLlama.

### Why Not the Existing SDK?

`@defillama/api` (npm) is a TypeScript SDK, not a CLI. It requires writing code to use, has no TOON output, no agent-friendly `--llms` manifest, no `--json` envelope, and can't be invoked from a cron prompt as a single command.

## API Surface

DefiLlama's API is split across multiple subdomains, all free and unauthenticated:

| Subdomain | Scope | Key Endpoints |
|---|---|---|
| `api.llama.fi` | TVL, protocols, chains | `/protocols`, `/v2/chains`, `/protocol/{name}`, `/v2/historicalChainTvl/{chain}` |
| `api.llama.fi` | Volumes (DEX) | `/overview/dexs`, `/overview/dexs/{chain}`, `/summary/dexs/{protocol}` |
| `api.llama.fi` | Fees & Revenue | `/overview/fees`, `/overview/fees/{chain}`, `/summary/fees/{protocol}` |
| `yields.llama.fi` | Yield pools | `/pools`, `/chart/{pool}` |
| `stablecoins.llama.fi` | Stablecoin supply | `/stablecoins`, `/stablecoinchains`, `/stablecoin/{id}` |
| `bridges.llama.fi` | Bridge volumes | `/bridges`, `/bridge/{id}`, `/transactions/{id}` |
| `coins.llama.fi` | Token prices | `/prices/current/{coins}`, `/prices/historical/{ts}/{coins}`, `/chart/{coins}` |

**Scale:** 435 chains, 19,262 yield pools, 342 stablecoins, 89 bridges.

## Proposed CLI Structure

```
defillama <command group> <subcommand> [options]
```

### Command Groups (Phase 1 — MVP)

These cover 90%+ of spectra's current DefiLlama usage:

#### `defillama tvl`
- `tvl protocols [--chain <chain>] [--category <cat>] [--min-tvl <usd>] [--sort tvl|change_1d|change_7d] [--limit N]`
- `tvl chains [--sort tvl|change_1d] [--limit N]`
- `tvl protocol <slug>` — detailed protocol TVL with chain breakdown
- `tvl history <chain> [--days N]` — historical chain TVL

#### `defillama volume`
- `volume dexs [--chain <chain>] [--sort volume|change_1d|change_7d] [--limit N]`
- `volume protocol <slug>` — detailed protocol volume history
- `volume aggregators [--chain <chain>]`

#### `defillama fees`
- `fees overview [--chain <chain>] [--sort fees|revenue] [--limit N]`
- `fees protocol <slug>` — detailed protocol fee/revenue history

#### `defillama prices`
- `prices current <coins...>` — current prices (coingecko:ethereum, abstract:0x...)
- `prices historical <timestamp> <coins...>`
- `prices chart <coins...> [--days N] [--period hourly|daily]`

### Command Groups (Phase 2 — Extended)

Lower priority, build if/when needed:

#### `defillama yields`
- `yields pools [--chain <chain>] [--min-tvl <usd>] [--min-apy <pct>] [--sort apy|tvl] [--limit N]`
- `yields chart <pool-id>`

#### `defillama stablecoins`
- `stablecoins list [--sort mcap|change_1d] [--limit N]`
- `stablecoins chains` — stablecoin supply by chain

#### `defillama bridges`
- `bridges list [--sort volume|txs] [--limit N]`
- `bridges transactions <bridge-id> [--chain <chain>]`

### Global Options

- `--json` — JSON envelope output (incur standard)
- `--verbose` — include raw API response metadata
- `--chain <name>` — filter by chain (case-insensitive, fuzzy match)
- `--limit N` — pagination/result limit (default: 20, agent-friendly)

### Key Design Decisions

1. **Chain as first-class filter.** Most of spectra's usage is chain-scoped (`--chain abstract`). Every list command should support chain filtering.

2. **Computed deltas in TOON output.** Raw API returns `change_1d`, `change_7d`, `change_1m` as numbers. TOON output should format these as `+12.3%` / `-5.1%` with directional indicators.

3. **Category separation.** The March 7 bug (mixing DEX and prediction market volume) happened because `/overview/dexs/` includes both categories. The CLI should expose `--category` filtering and clearly label categories in output.

4. **No auth required.** DefiLlama API is free and unauthenticated. No `cli-shared` auth middleware needed — just rate limiting (shared `createRateLimiter` at 5 req/s).

5. **Shared package: `@spectratools/tx-shared`.** Reuse existing shared utilities (rate limiter, address formatting, timestamp formatting).

## Scoring Against Evaluation Criteria

| Criterion | Score (1-5) | Rationale |
|---|---|---|
| Agent friction | **5** | Highest-friction raw HTTP dependency. web_fetch + inline JSON parsing on every cron run. 50KB truncation actively breaks workflows. |
| Usage frequency | **5** | Used multiple times daily by opportunity explorer cron + ad-hoc research. |
| API stability | **5** | Free, unauthenticated, well-structured REST API. 435 chains. Active maintenance (SDK last published Feb 2026). |
| Coverage gap | **5** | No agent-friendly CLI exists. Only a JS SDK (`@defillama/api`). |
| Complexity | **5** | 7 endpoint groups, chain filtering, time series, category taxonomy. Rich enough for a proper CLI. |
| **Total** | **25/25** | |

## Runner-Up Candidates

### Abstract Portal API (Score: 14/25)
- Only 4 endpoints (apps list, app detail, streams, user profile)
- Used ad-hoc, not in crons
- Too simple for a CLI — better as inline web_fetch calls

### CoinGecko API (Score: 15/25)
- Overlaps heavily with DefiLlama `coins.llama.fi` (prices, market data)
- Requires API key for most endpoints
- Several unofficial CLIs already exist
- DefiLlama prices command covers 80% of the use case

## Implementation Plan

### Phase 1 (MVP — ~4-6 hours estimated)
1. Scaffold `packages/defillama/` with incur CLI structure
2. Implement `tvl`, `volume`, `fees`, `prices` command groups
3. Chain filtering + category filtering
4. TOON output with formatted deltas
5. Rate limiter integration
6. Tests (mock API responses)
7. `--llms` manifest

### Phase 2 (Extended — ~2-3 hours)
1. `yields`, `stablecoins`, `bridges` command groups
2. Historical time series with sparkline output
3. Protocol comparison mode (`defillama compare <slug1> <slug2>`)

### Phase 3 (Integration)
1. Update `abstract-opportunity-explorer` cron to use `defillama` CLI instead of web_fetch
2. Update morning briefing to use `defillama tvl chains --chain abstract`
3. Add to spectra skills for agent-level discovery

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| DefiLlama API changes/breaks | Pin to known endpoint paths; API has been stable for 2+ years |
| Large response sizes (protocols list = 2MB) | CLI-side filtering before output; `--limit` pagination |
| Rate limiting | Shared rate limiter at 5 req/s (same as etherscan CLI) |
| Scope creep (7 endpoint groups) | Phase 1 MVP covers 90% of usage; Phase 2 only if needed |

## Success Criteria

1. Opportunity explorer cron can replace all `web_fetch` calls with `defillama` CLI commands
2. No more 50KB truncation on DeFi data
3. Per-cron-run token cost reduced by estimated 40-60% (structured output vs raw JSON parsing)
4. `defillama volume dexs --chain abstract` returns the same data quality as current inline approach
