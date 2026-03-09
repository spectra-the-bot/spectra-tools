# Guide: Agent Integration

`assembly-cli` is built for both humans and AI runtimes.

This guide covers how to expose the CLI to agents and produce reliable machine-readable output.

## 1) Discover command surface (`--llms` / `--llms-full`)

Print an LLM-readable command manifest:

```bash
# Compact command index
assembly-cli --llms

# Full manifest with arguments, env vars, and output fields
assembly-cli --llms-full
```

Use `--llms` for quick discovery and `--llms-full` when bootstrapping tools in an agent harness so the model can inspect all available commands and arguments.

## 2) Get structured command contracts (`--schema`)

Get JSON Schema for a command to validate arguments/output expectations:

```bash
assembly-cli governance proposals --schema
assembly-cli governance proposal --schema
assembly-cli council seats --schema
```

This is useful for typed wrappers and guardrails in orchestrators.

## 3) Register as an agent skill (`skills add`)

```bash
assembly-cli skills add
```

This syncs skill files so compatible agent runtimes can call the CLI as a tool.

## 4) Register as MCP server (`mcp add`)

```bash
assembly-cli mcp add
```

Use this when your agent framework prefers MCP discovery/invocation.

## 5) Prefer machine-readable output for automation

### JSON output

```bash
assembly-cli governance proposals --format json
assembly-cli status --format json
```

### Include metadata envelope (`--verbose`)

```bash
assembly-cli governance proposal 42 --format json --verbose
```

### Narrow payloads (`--filter-output`)

```bash
assembly-cli governance proposal 42 --format json --filter-output id,status,voteEndAt
assembly-cli status --format json --filter-output activeMemberCount,proposalCount
```

## 6) Example: polling loop primitive

```bash
assembly-cli governance proposals --format json --filter-output proposals
```

Agent workflow pattern:
1. Fetch proposals list
2. Detect status transitions by proposal id
3. On change, query `assembly-cli governance proposal <id> --format json --verbose`
4. Emit alert/event to downstream systems

## 7) Reliability tips for agent systems

- Pin a consistent output format (`--format json`)
- Use `--filter-output` to minimize token usage
- Use `--schema` to validate command contracts before deployment
- Keep command reference nearby for parameter details

## Related docs

- [Assembly overview](/assembly/)
- [Assembly configuration](/assembly/configuration)
- [Assembly command reference](/assembly/commands)
- [Governance monitoring guide](/assembly/guides/governance-monitoring)
