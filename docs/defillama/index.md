# 📊 DefiLlama CLI

**Query DefiLlama API data from the command line** — TVL rankings, DEX volume, protocol fees, and token prices from one tool.

`@spectratools/defillama-cli` provides four command groups:

- `tvl` — Total value locked
- `volume` — DEX trading volume
- `fees` — Protocol fees and revenue
- `prices` — Token prices

::: tip No API key required
DefiLlama is a free, public API. No authentication or setup needed.
:::

## Install

::: code-group

```bash [npm]
npm install -g @spectratools/defillama-cli
```

```bash [pnpm]
pnpm add -g @spectratools/defillama-cli
```

```bash [npx (no install)]
npx @spectratools/defillama-cli tvl protocols --limit 10
```

:::

## Quick Examples

```bash
# 1) Top protocols by TVL
defillama-cli tvl protocols --limit 10

# 2) Chain-specific TVL ranking
defillama-cli tvl protocols --chain ethereum --limit 10

# 3) Protocol detail with chain breakdown
defillama-cli tvl protocol aave

# 4) Top DEXes by trading volume
defillama-cli volume dexs --limit 10

# 5) Current token price
defillama-cli prices current ethereum:0xdAC17F958D2ee523a2206206994597C13D831ec7

# 6) Protocol fees
defillama-cli fees overview --limit 10
```

## Agent Integration

```bash
# LLM-readable command manifest
defillama-cli --llms

# Register as a local skill
defillama-cli skills add

# Register as an MCP server
defillama-cli mcp add
```

## Reference

- [Command reference](/defillama/commands) — full command list with arguments and examples
