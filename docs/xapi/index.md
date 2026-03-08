# 📡 X API CLI

`@spectratools/xapi-cli` is a command-line interface for X (Twitter) API v2 workflows.

Use it to automate:

- **Users** — profile lookup, followers/following, posts, mentions, and user search
- **Posts** — get, search, create/delete, likes, and retweets
- **Timelines** — home and mentions timelines
- **Lists** — list details, members, and list posts
- **Trends** — available places and location-based trends
- **DMs** — conversations and outbound direct messages

The package exposes commands across `users`, `posts`, `timeline`, `lists`, `trends`, and `dm` command groups.

## Install

::: code-group

```bash [npx (no install)]
npx @spectratools/xapi-cli posts search "ai agents" --max-results 5
```

```bash [npm]
npm install -g @spectratools/xapi-cli
```

```bash [pnpm]
pnpm add -g @spectratools/xapi-cli
```

:::

## Quick examples

```bash
# 1) Get a user profile
xapi-cli users get jack

# 2) Search recent posts by keyword
xapi-cli posts search "abstract chain" --sort relevancy --max-results 10

# 3) Pull posts from a specific user
xapi-cli users posts jack --max-results 5
```

## Authentication

| Token | Access pattern | Typical use |
|---|---|---|
| `X_BEARER_TOKEN` | **Read-only app auth** | Search, profile/list/timeline reads, trends (subject to project access) |
| `X_ACCESS_TOKEN` | **OAuth 2.0 user context (read + write)** | Required for write actions (`posts create`, `posts delete`, `dm send`) and needed for some read endpoints |

```bash
# Read-only setup
export X_BEARER_TOKEN="your-app-bearer-token"

# Read + write setup
export X_ACCESS_TOKEN="your-oauth2-user-access-token"
```

::: tip
If both are set, `xapi-cli` prefers `X_ACCESS_TOKEN`.
:::

## Use with agents

```bash
# Structured data for automation
xapi-cli posts search "ai agents" --max-results 10 --json

# Discover command capabilities
xapi-cli --llms

# Register as local skill / MCP endpoint
xapi-cli skills add
xapi-cli mcp add
```

## Reference

- [Command reference](/xapi/commands)
- [Configuration](/xapi/configuration)
- [Guide: Social monitoring](/xapi/guides/social-monitoring)
- [Guide: Agent integration](/xapi/guides/agent-integration)
