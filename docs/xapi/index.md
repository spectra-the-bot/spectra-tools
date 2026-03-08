# 📡 X API CLI

**Automate X (Twitter) from your terminal** — search posts, pull timelines, manage lists, send DMs, and build content workflows using X API v2.

## Install

::: code-group

```bash [npx (no install)]
npx @spectratools/xapi-cli posts search "abstract chain" --limit 5
```

```bash [npm]
npm install -g @spectratools/xapi-cli
```

```bash [pnpm]
pnpm add -g @spectratools/xapi-cli
```

:::

## What you can do

### Posts

Search, look up, create, and delete posts:

```bash
xapi-cli posts search "abstract chain" --limit 10
xapi-cli posts get 1234567890
xapi-cli posts create "Hello from the CLI"
xapi-cli posts delete 1234567890
```

### Users

Look up profiles and query social graphs:

```bash
xapi-cli users profile abstractchain
xapi-cli users followers abstractchain --limit 20
xapi-cli users following abstractchain --limit 20
```

### Timeline

Poll home and mentions timelines:

```bash
xapi-cli timeline home --limit 10
xapi-cli timeline mentions --limit 10
```

### Lists

Discover and manage X lists:

```bash
xapi-cli lists owned --limit 10
xapi-cli lists members 1234567890 --limit 20
```

### Trends

Discover trending topics:

```bash
xapi-cli trends places
```

::: warning Known issue
The `trends` command group has a known limitation — some queries may not return results. This will be fixed in a future release.
:::

### Direct Messages

Send and read DMs:

```bash
xapi-cli dm send 1234567890 "Hey there"
xapi-cli dm list --limit 10
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `X_BEARER_TOKEN` | For read-only access | App bearer token for search, profiles, timelines, lists |
| `X_ACCESS_TOKEN` | For write access | OAuth 2.0 user token for posts, DMs. Also used for reads when set. |

```bash
export X_BEARER_TOKEN="your-x-bearer-token"
# or for full access:
export X_ACCESS_TOKEN="your-x-access-token"
```

## Use with agents

```bash
# Structured JSON output
xapi-cli posts search "abstract chain" --limit 5 --json

# Full CLI manifest for agent discovery
xapi-cli --llms

# Register as an agent skill or MCP server
xapi-cli skills add
xapi-cli mcp add
```

## Reference

- [Command reference](/xapi/commands) — full list of commands with arguments and examples
- [Configuration](/configuration) — environment variables
- [Agent integration](/agent-integration) — discovery, schemas, and structured output
