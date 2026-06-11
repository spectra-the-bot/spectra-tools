# @spectratools/debank-cli

DeBank Pro API CLI for blockchain and DeFi data — chains, protocols, tokens, pools, wallet portfolios, approvals, and read-only transaction simulation.

Built from the [DeBank MCP server](https://github.com/demcp/demcp-debank-mcp) API patterns, repackaged as an [incur](https://github.com/wevm/incur)-based CLI with TOON output, JSON mode, agent skill discovery, and pagination.

## Install

```bash
pnpm add -g @spectratools/debank-cli
```

## LLM / Agent Discovery

```bash
# Emit machine-readable command metadata
debank-cli --llms

# Register as a reusable local skill for agent runtimes
debank-cli skills add

# Register as an MCP server entry
debank-cli mcp add
```

## Configuration

Requires a [DeBank Pro API](https://pro.debank.com/) access key:

```bash
export ACCESS_KEY=your_debank_api_key
```

The key is sent as an `AccessKey` request header (never as a query parameter) and is only ever transmitted to `https://pro-openapi.debank.com`.

## Chains

DeBank uses short string chain ids (e.g. `eth`, `bsc`, `xdai`, `matic`, `arb`, `op`, `base`). Friendly aliases are accepted and normalized:

| Alias | DeBank id |
|---|---|
| `ethereum`, `mainnet` | `eth` |
| `binance`, `bnb` | `bsc` |
| `gnosis` | `xdai` |
| `polygon` | `matic` |
| `arbitrum` | `arb` |
| `optimism` | `op` |

Any DeBank-native chain id passes through untouched, so the full set of 100+ supported chains works even without an alias. Run `debank-cli chain list` to enumerate them.

## Command Groups

- `chain` — Supported chains and their metadata (`info`, `list`)
- `protocol` — DeFi protocol details, per-chain listings sorted by TVL, and top holders (`info`, `list`, `holders`)
- `token` — Token metadata, top holders, and historical prices (`info`, `holders`, `history`)
- `pool` — Liquidity pool details (`info`)
- `user` — Wallet portfolio: balances, tokens, NFTs, used chains, protocol positions, history, net-worth curve, and token/NFT approvals (`balance`, `tokens`, `token`, `nfts`, `chains`, `protocols`, `history`, `chart`, `token-auth`, `nft-auth`)
- `collection` — NFTs within a collection (`nfts`)
- `wallet` — Gas market, transaction explanation, and read-only simulation (`gas`, `explain`, `simulate`)

## Examples

```bash
# List supported chains
debank-cli chain list

# Top 10 Ethereum protocols by TVL
debank-cli protocol list eth --page-size 10

# USDC metadata on Ethereum
debank-cli token info eth 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48

# A wallet's total net worth across all chains
debank-cli user balance 0xWALLET

# A wallet's token balances on Ethereum
debank-cli user tokens 0xWALLET --chain eth

# A wallet's token approvals (security review)
debank-cli user token-auth 0xWALLET eth

# Gas price tiers on Ethereum
debank-cli wallet gas eth

# Dry-run a transaction (no signing, no broadcast)
debank-cli wallet simulate @tx.json
```

## Safety

`wallet explain` and `wallet simulate` are **read-only** — they ask DeBank to decode or pre-execute a transaction object you supply, and never sign or broadcast anything. This CLI holds no private keys and cannot move funds; every command is a read against the DeBank Pro API.

## Output

Default output is [TOON](https://github.com/wevm/incur). Add `--json` for structured JSON, `--format yaml|md|jsonl` for alternatives, and `--verbose` for the full `{ ok, data, meta }` envelope. List commands accept `--page` and `--page-size`.

## License

MIT
