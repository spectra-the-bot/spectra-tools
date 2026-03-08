# Agent Integration

This guide shows a practical pattern for using `@spectratools/erc8004-cli` inside AI-agent workflows.

## Suggested pipeline

1. **Discover** candidate agents
2. **Resolve** canonical identifiers
3. **Inspect identity + registration** data
4. **Optionally evaluate reputation/validation**

## Example flow

```bash
# 1) Discover by service
erc8004-cli discovery search --service mcp --limit 10 --json

# 2) Resolve canonical identifier
erc8004-cli discovery resolve 0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:634 --json

# 3) Pull identity + registration
erc8004-cli identity get 634 --json
erc8004-cli registration fetch 634 --json

# 4) Optional trust signals
erc8004-cli reputation get 634 --json
erc8004-cli validation history 634 --json
```

⚠️ Reputation and validation calls may error/revert for agents that do not yet have initialized data.

## Agent runtime integration helpers

```bash
# Structured responses
erc8004-cli identity get 634 --json

# Machine-readable command manifest
erc8004-cli --llms

# Register with local runtime catalogs
erc8004-cli skills add
erc8004-cli mcp add
```

## Preview considerations

ERC-8004 support is currently preview/experimental. Keep integrations defensive:

- handle missing data gracefully
- treat unavailable reputation/validation as unknown state
- retry transient RPC/network failures
