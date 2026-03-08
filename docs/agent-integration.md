# Agent Integration

All `@spectratools/*-cli` packages are designed for machine-first usage while staying ergonomic for humans.

## `--llms` manifest

Use `--llms` to export command metadata as markdown (commands, arguments, env vars, output fields, and examples):

```bash
assembly-cli --llms
etherscan-cli --llms
xapi-cli --llms
erc8004-cli --llms
```

This is the source used by this docs site for command references.

## Register as a local skill

Each CLI can install/update local agent skill metadata:

```bash
assembly-cli skills add
etherscan-cli skills add
xapi-cli skills add
erc8004-cli skills add
```

## Register as an MCP server

Each CLI can also scaffold MCP entries:

```bash
assembly-cli mcp add
etherscan-cli mcp add
xapi-cli mcp add
erc8004-cli mcp add
```

## Machine consumption patterns

### Schema-first integration

```bash
# get JSON Schema for a specific command
assembly-cli governance proposal --schema
xapi-cli posts search --schema
```

Use the schema to validate command inputs/outputs in agents and pipelines.

### Structured output

```bash
# JSON output for deterministic parsing
erc8004-cli discovery search --service mcp --limit 5 --format json
etherscan-cli gas oracle --chain abstract --format json
```

Common machine-safe flags:

- `--format json` for parsable output
- `--schema` for JSON Schema contracts
- `--filter-output` for reducing payload size
- `--token-limit` / `--token-offset` for bounded LLM context

## Suggested pipeline

1. Discover tool capabilities from `--llms`.
2. Pull per-command schema with `--schema`.
3. Execute with `--format json`.
4. Validate and route results into your orchestrator memory/prompt.
