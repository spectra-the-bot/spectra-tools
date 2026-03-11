---
layout: home

hero:
  name: spectra-tools
  text: CLI tools for the Abstract ecosystem
  tagline: Query governance, explore chains, monitor social feeds, and discover onchain agents — from your terminal or any AI agent.
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/spectra-the-bot/spectra-tools

features:
  - icon: 🏛️
    title: Assembly CLI
    details: Monitor governance proposals, council seats, treasury, forum threads, and member activity on Abstract's Assembly contracts.
    link: /assembly/
    linkText: Learn more
  - icon: 🔍
    title: Etherscan CLI
    details: Look up balances, transactions, contracts, tokens, and gas data across any EVM chain via Etherscan's V2 API.
    link: /etherscan/
    linkText: Learn more
  - icon: 📡
    title: X API CLI
    details: Search posts, pull timelines, manage lists, send DMs, and automate content workflows on X (Twitter) via API v2.
    link: /xapi/
    linkText: Learn more
  - icon: 🤖
    title: ERC-8004 CLI
    details: Explore trustless agent identity, reputation, and validation registries on Abstract. Experimental preview.
    link: /erc8004/
    linkText: Learn more (preview)
  - icon: 🌊
    title: Aborean CLI
    details: Interact with Aborean DEX on Abstract — swap tokens, query pools, check liquidity, and manage positions from the terminal.
    link: /aborean/
    linkText: Learn more
  - icon: 📊
    title: DefiLlama CLI
    details: Query TVL rankings, DEX volumes, protocol fees, and token prices from DefiLlama's public API.
    link: /defillama/
    linkText: Learn more
  - icon: 🖼️
    title: Figma CLI
    details: Access Figma files, nodes, components, comments, and token exports via the Figma REST API.
    link: /figma/
    linkText: Learn more
  - icon: 🎨
    title: Graphic Designer CLI
    details: Generate deterministic code screenshots, terminal shots, flowcharts, and infographics — no browser required. Designed for AI agent workflows.
    link: /graphic-designer/
    linkText: Learn more
---

## Try it now

No install required — run directly with `npx`:

```bash
# Check Assembly governance status on Abstract
npx @spectratools/assembly-cli status

# Look up an Ethereum account balance
npx @spectratools/etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum

# Search recent posts on X
npx @spectratools/xapi-cli posts search "abstract chain" --max-results 5

# Swap tokens on Aborean DEX on Abstract
npx @spectratools/aborean-cli pools list

# Query top protocols by TVL on DefiLlama
npx @spectratools/defillama-cli tvl protocols --limit 10

# Fetch a Figma file document
npx @spectratools/figma-cli files get <file-key>

# Generate a code screenshot
npx @spectratools/graphic-designer-cli render --spec spec.json --out output.png
```

## Built for agents

Every CLI is designed to work equally well for humans in a terminal and AI agents in a pipeline.

```bash
# Human-friendly output (default)
assembly-cli governance proposals

# Machine-readable JSON for agents and scripts
assembly-cli governance proposals --format json

# Export compact command index for agent discovery
assembly-cli --llms

# Export full CLI manifest with all details
assembly-cli --llms-full

# Get JSON Schema for any command
assembly-cli governance proposals --schema
```

### Agent integration in 30 seconds

```bash
# Register as a local agent skill
assembly-cli skills add

# Register as an MCP server
assembly-cli mcp add
```

Every CLI supports `skills add` and `mcp add` out of the box — no configuration needed.

## Output formats

All CLIs share a consistent `--format` flag:

| Format | Best for |
|--------|----------|
| `toon` | Human-friendly terminal output (default) |
| `json` | Scripts, agents, and structured pipelines |
| `yaml` | Configuration-style readable output |
| `md` | Documentation and changelogs |
| `jsonl` | Streaming and line-oriented processing |

## What's next?

<div class="tip custom-block" style="padding-top: 8px">

**Ready to dive in?** Start with the [Getting Started guide](/getting-started) or jump straight to a CLI: [Assembly](/assembly/) · [Etherscan](/etherscan/) · [X API](/xapi/) · [ERC-8004](/erc8004/) · [Aborean](/aborean/) · [DefiLlama](/defillama/) · [Figma](/figma/) · [Graphic Designer](/graphic-designer/)

</div>
