# Guide: Agent Integration with `xapi-cli`

`xapi-cli` is designed for machine-friendly use in agent pipelines.

## 1) Discover command capabilities

Use the built-in manifest to inspect commands:

```bash
# Compact command index
xapi-cli --llms

# Full manifest with args, env vars, and output fields
xapi-cli --llms-full
```

For command-level schema introspection:

```bash
xapi-cli posts search --schema
xapi-cli users get --schema
xapi-cli dm send --schema
```

## 2) Execute with structured output

Use JSON output for deterministic parsing:

```bash
xapi-cli posts search "ai agents" --max-results 10 --json
xapi-cli users get jack --json
```

For richer orchestration metadata, add `--verbose`.

## 3) Pick an auth profile for your agent

### Read-only agent profile

Use bearer auth when the agent only needs read operations.

```bash
export X_BEARER_TOKEN="your-app-bearer-token"
```

### Read + write agent profile

Use OAuth user context when the agent may post or send DMs.

```bash
export X_ACCESS_TOKEN="your-oauth2-user-access-token"
```

Write commands (`posts create`, `posts delete`, `dm send`) require `X_ACCESS_TOKEN`.

## 4) Example agent loop

A minimal monitor-and-respond pattern:

```bash
# discover
xapi-cli --llms-full

# gather context
xapi-cli users posts abstractchain --max-results 5 --json
xapi-cli posts search "abstract chain" --max-results 10 --json

# optional action (requires X_ACCESS_TOKEN)
xapi-cli posts create --text "Tracking updates from the ecosystem." --json
```

## 5) Reliability tips

- Parse command output as JSON, not terminal text.
- Validate command arguments using `--schema` before execution.
- Separate read-only and write-capable credentials in your runtime.
- Handle endpoint-specific auth limitations (for example, `users search` may require `X_ACCESS_TOKEN`).
