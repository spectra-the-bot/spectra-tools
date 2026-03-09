# @spectratools/assembly-cli

Assembly is the governance layer for protocols on the Abstract chain: it manages membership, council seats, proposals, forum participation, and treasury controls through onchain contracts. Abstract is an Ethereum L2 focused on consumer-facing apps and agent-friendly infrastructure. This CLI gives operators and agents one interface to query Assembly state, run checks, and power automation.

Learn more:

- Abstract site: https://abs.xyz
- Abstract docs: https://docs.abs.xyz

## Install

```bash
pnpm add -g @spectratools/assembly-cli
```

## LLM / Agent Discovery

```bash
# Emit machine-readable command metadata
assembly-cli --llms

# Register as a reusable local skill for agent runtimes
assembly-cli skills add

# Register as an MCP server entry
assembly-cli mcp add
```

## Configuration

| Variable | Required | Description |
|---|---|---|
| `ABSTRACT_RPC_URL` | No | Abstract RPC URL override (default from package client) |
| `ASSEMBLY_INDEXER_URL` | No | Optional member snapshot endpoint for `members list` (falls back to on-chain `Registered` events with a warning if unavailable) |

## Shared tx integration pattern (`@spectratools/tx-shared`)

`assembly-cli` write flows are powered by `@spectratools/tx-shared` (`executeTx` lifecycle + structured `TxError`s).

If you're building a consumer CLI command (or extending Assembly write behavior), use the shared pattern:

1. Parse signer flags/env via `toSignerOptions(...)`
2. Resolve signer with `resolveSigner(...)`
3. Build write request (`address`, `abi`, `functionName`, `args`/`value`)
4. Execute with `executeTx(...)` and handle `dryRun` + `TxError.code`

Reference wiring:

- Assembly example: [`src/examples/tx-shared-register.ts`](./src/examples/tx-shared-register.ts)
- tx-shared docs: [`../tx-shared/README.md`](../tx-shared/README.md)
- tx-shared assembly-style example: [`../tx-shared/src/examples/assembly-write.ts`](../tx-shared/src/examples/assembly-write.ts)

Current `assembly-cli` write commands require `PRIVATE_KEY`, but tx-shared supports broader provider setup for consumer CLIs:

- private key (`PRIVATE_KEY`)
- keystore (`--keystore` + `--password` or `KEYSTORE_PASSWORD`)
- Privy (`PRIVY_APP_ID`, `PRIVY_WALLET_ID`, `PRIVY_AUTHORIZATION_KEY`; implementation tracked in [#117](https://github.com/spectra-the-bot/spectra-tools/issues/117))

## Command Group Intent Summary

- `members` — Membership state, counts, and registry fee settings
- `council` — Seat occupancy, active council members, auction slots, and council params
- `forum` — Threads, comments, petitions, and petition participation checks
- `governance` — Proposal index/details, vote participation checks, governance params
- `treasury` — Treasury balance, whitelist checks, major-spend status, execution checks
- root commands (`status`, `health`) — Cross-contract snapshots for bots/monitors

## Usage

```bash
assembly-cli <group> <command> [args] [options]
```

## Agent-Oriented Examples

```bash
# 1) Agent startup snapshot: report system health in one call
assembly-cli status --json

# 2) Verify whether an address can currently participate as council
assembly-cli council is-member 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --format json

# 3) Pull active member roster with relative activity timings
# Note: best results require ASSEMBLY_INDEXER_URL; if the indexer returns 404/unavailable,
# the CLI falls back to onchain Registered events and output may be slower or partial.
assembly-cli members list --json

# 4) Pre-vote automation: list proposals and fetch one in detail
assembly-cli governance proposals --format json
assembly-cli governance proposal 1 --json

# 5) Treasury monitoring loop: balance + spend lock status
assembly-cli treasury balance --format json
assembly-cli treasury major-spend-status --json
```

## Output Mode

All commands support structured JSON output for agents with either `--json` or `--format json`:

```bash
assembly-cli forum threads --json
assembly-cli forum threads --format json
```
