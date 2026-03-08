# @spectratools/xapi-cli

X (Twitter) API v2 CLI for post, user, list, trend, timeline, and DM workflows.

## Install

```bash
pnpm add -g @spectratools/xapi-cli
```

## LLM / Agent Discovery

```bash
# Emit machine-readable command metadata
xapi-cli --llms

# Register as a reusable local skill for agent runtimes
xapi-cli skills add

# Register as an MCP server entry
xapi-cli mcp add
```

## Configuration

```bash
export X_BEARER_TOKEN=your_bearer_token_here
```

## Command Group Intent Summary

- `posts` — Read/search/create/delete posts and inspect social engagement
- `users` — Profile lookup, social graph traversal, and user timelines
- `timeline` — Home timeline and mention stream monitoring
- `lists` — List discovery, member inspection, and list feed reads
- `trends` — Trend place discovery and per-location trend fetch
- `dm` — Conversation listing and outbound direct messages

## Agent-Oriented Examples

```bash
# 1) Trend-to-content pipeline
xapi-cli trends places --format json
xapi-cli trends location 1 --format json
xapi-cli posts search "AI agents" --sort relevancy --max-results 20 --format json

# 2) User intelligence pass
xapi-cli users get jack --format json
xapi-cli users posts jack --max-results 20 --format json
xapi-cli users followers jack --max-results 100 --format json

# 3) Moderation helper flow
xapi-cli posts get 1234567890 --format json
xapi-cli posts likes 1234567890 --max-results 100 --format json
xapi-cli posts retweets 1234567890 --max-results 100 --format json

# 4) Timeline monitor
xapi-cli timeline home --max-results 50 --format json
xapi-cli timeline mentions --max-results 50 --format json

# 5) DM assistant loop
xapi-cli dm conversations --max-results 20 --format json
xapi-cli dm send 12345 --text "hello from agent" --format json
```

## Notes

- All commands support JSON output with `--format json`.
- Write actions (post create/delete, DM send) require token scope compatible with user-context endpoints.
