# 💱 Aborean CLI

`@spectratools/aborean-cli` is a CLI for Aborean Finance DEX on Abstract — pools, swaps, gauges, and voting escrow.

Use it to inspect:
- liquidity pools and pair data
- concentrated liquidity vaults
- gauge weights and emissions
- voting escrow (ve) positions
- lending markets

It is designed for:
- **DeFi participants** who need fast, verifiable DEX data
- **liquidity providers** tracking pools, gauges, and rewards
- **agents/automation** that need structured, machine-readable output

## Install

::: code-group

```bash [npx (no install)]
npx @spectratools/aborean-cli pools list
```

```bash [npm]
npm install -g @spectratools/aborean-cli
```

```bash [pnpm]
pnpm add -g @spectratools/aborean-cli
```

:::

## Quick examples

```bash
# List liquidity pools
aborean-cli pools list

# Query gauge data
aborean-cli gauges list

# Check voting escrow positions
aborean-cli ve locks

# View vault data
aborean-cli vaults list
```

## Reference

- [Command reference](/aborean/commands)
