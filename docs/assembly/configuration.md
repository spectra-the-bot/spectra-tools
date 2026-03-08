# Assembly CLI Configuration

Assembly CLI is **zero-config by default**.

If you do nothing, it connects to Abstract mainnet public RPC automatically.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ABSTRACT_RPC_URL` | No | `https://api.mainnet.abs.xyz` | Override the RPC endpoint used for onchain Assembly reads. |
| `ASSEMBLY_INDEXER_URL` | No | Built-in Assembly indexer endpoint | Optional indexer URL used by member snapshot commands (for faster member listing/count workflows). |

## Override RPC/indexer

```bash
export ABSTRACT_RPC_URL="https://your-rpc.example"
export ASSEMBLY_INDEXER_URL="https://your-indexer.example"

assembly-cli status
assembly-cli members list
```

You can also set a variable for a single command:

```bash
ABSTRACT_RPC_URL="https://your-rpc.example" assembly-cli governance proposals
```

## Output options

Assembly CLI supports several output controls for terminal and automation workflows.

### `--format`

Use `--format` to choose output shape.

Supported values include:
- `toon` (default, human-first)
- `json`
- `yaml`
- `md`

```bash
assembly-cli governance proposals --format toon
assembly-cli governance proposals --format json
assembly-cli governance proposals --format yaml
assembly-cli governance proposals --format md
```

> Note: current releases also expose `jsonl` in help output for line-oriented pipelines.

### `--verbose`

Add command metadata and full envelope output:

```bash
assembly-cli governance proposal 42 --format json --verbose
```

### `--filter-output`

Return only specific key paths from output payloads:

```bash
assembly-cli governance proposal 42 --format json --filter-output id,status,voteEndAt
assembly-cli status --format json --filter-output activeMemberCount,proposalCount
```

## Related docs

- [Assembly overview](/assembly/)
- [Assembly command reference](/assembly/commands)
- [Governance monitoring guide](/assembly/guides/governance-monitoring)
- [Agent integration guide](/assembly/guides/agent-integration)
