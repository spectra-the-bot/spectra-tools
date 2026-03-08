# Agent Integration

spectra-tools CLIs are designed from the ground up for AI agent consumption. Every CLI includes built-in discovery, schema introspection, structured output, and one-command registration — making them first-class tools in any agent workflow.

## Why this matters

Most CLIs are built for humans and retrofitted for machines. spectra-tools takes the opposite approach: **every command is agent-ready by default**, with human-friendly output as the default view.

- **Structured output** — `--format json` on any command, every time
- **Self-describing** — agents can discover capabilities without documentation
- **Schema-first** — JSON Schema for every command's inputs and outputs
- **Zero-config registration** — `skills add` and `mcp add` just work

## Discover capabilities

### CLI manifest (`--llms`)

Every CLI can export its full command tree, arguments, environment variables, output fields, and examples as a markdown manifest:

```bash
assembly-cli --llms
etherscan-cli --llms
xapi-cli --llms
erc8004-cli --llms
```

This is the single source of truth for what a CLI can do. Agents can parse this to understand available commands before executing them.

### Command schema (`--schema`)

Get the JSON Schema for any specific command:

```bash
assembly-cli governance proposals --schema
etherscan-cli account balance --schema
xapi-cli posts search --schema
```

Use schemas to validate inputs before execution or to generate type-safe wrappers.

## Register with your agent

### As a local skill

```bash
assembly-cli skills add
etherscan-cli skills add
xapi-cli skills add
erc8004-cli skills add
```

This writes skill metadata to your local agent's skill discovery path. Agents that support skill directories (like [OpenClaw](https://github.com/coffeexcoin/openclaw)) will automatically discover the CLI.

### As an MCP server

```bash
assembly-cli mcp add
etherscan-cli mcp add
xapi-cli mcp add
erc8004-cli mcp add
```

This registers the CLI as a [Model Context Protocol](https://modelcontextprotocol.io/) server, making it available to any MCP-compatible agent or IDE.

## Structured output

### Data profile (default for scripts)

Use `--format json` (or `--json`) for clean, parseable output:

```bash
assembly-cli governance proposals --limit 3 --json
```

```json
[
  { "id": "1", "title": "Proposal Alpha", "status": "active" },
  { "id": "2", "title": "Proposal Beta", "status": "passed" }
]
```

On success, you get the data directly. On error, you get an error object. No wrapper, no envelope — just the payload.

### Envelope profile (for orchestration)

Add `--verbose` for a full metadata envelope:

```bash
assembly-cli governance proposals --limit 3 --json --verbose
```

```json
{
  "ok": true,
  "data": [...],
  "meta": {
    "command": "governance proposals",
    "duration": "142ms"
  }
}
```

The envelope includes execution metadata useful for logging, telemetry, and orchestration pipelines.

### Other formats

```bash
--format yaml    # readable key-value output
--format md      # markdown tables and headings
--format jsonl   # newline-delimited JSON for streaming
```

## Control output size

For LLM context management, use token-aware pagination:

```bash
assembly-cli governance proposals --json --token-limit 2000
assembly-cli governance proposals --json --token-limit 2000 --token-offset 2000
```

Or filter to specific fields:

```bash
etherscan-cli account balance 0x... --json --filter-output "balance,symbol"
```

## Recommended agent pipeline

```
1. Discover    →  assembly-cli --llms
2. Introspect  →  assembly-cli governance proposals --schema
3. Execute     →  assembly-cli governance proposals --limit 5 --json
4. Validate    →  check exit code + parse JSON
5. Route       →  feed results into agent memory/prompt
```

This pattern works with any orchestrator — LangChain, OpenClaw, custom agents, or simple shell scripts.

## Example: agent skill file

After running `assembly-cli skills add`, your agent gets a skill definition like:

```yaml
name: assembly-cli
description: Assembly governance CLI for Abstract
commands:
  - governance proposals
  - governance proposal
  - members list
  - council seats
  - treasury balances
  - forum threads
  # ... full command list
```

The agent can then reason about which command to call based on user intent, execute it with `--json`, and parse the structured response.
