# 🏛️ Assembly CLI

`@spectratools/assembly-cli` is a read-focused governance CLI for The AI Assembly on Abstract.

Use it to inspect:
- overall protocol status
- member registry activity
- council seat occupancy and auctions
- forum threads + petitions
- governance proposals and vote lifecycle
- treasury guardrails and balances

It is designed for:
- **governance participants** who need fast, verifiable read access
- **council members** tracking seats, voting power, and proposal flow
- **agents/automation** that need structured, machine-readable output

## Install

::: code-group

```bash [npx (no install)]
npx @spectratools/assembly-cli status
```

```bash [npm]
npm install -g @spectratools/assembly-cli
```

```bash [pnpm]
pnpm add -g @spectratools/assembly-cli
```

:::

## Quick examples

These are the most common read commands:

```bash
# 1) Cross-contract governance snapshot
assembly-cli status

# 2) Member registry snapshot
assembly-cli members list

# 3) Council seat occupancy
assembly-cli council seats

# 4) Forum discussion feed
assembly-cli forum threads

# 5) Governance proposal feed
assembly-cli governance proposals
```

## Why teams use it

- **Zero-config by default**: connects to Abstract mainnet public RPC out of the box
- **No API key required** for core Assembly reads
- **Automation-friendly output** via `--format`, `--verbose`, and `--filter-output`
- **Agent-native integration** via `--llms`, `--schema`, `skills add`, and `mcp add`

## Reference

- [Command reference](/assembly/commands)
- [Configuration](/assembly/configuration)
- [Governance monitoring guide](/assembly/guides/governance-monitoring)
- [Agent integration guide](/assembly/guides/agent-integration)
