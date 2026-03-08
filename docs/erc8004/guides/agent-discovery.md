# Agent Discovery

Use `erc8004-cli` to discover agents, inspect identity data, and resolve canonical identifiers.

## Look up an identity by agent ID

```bash
erc8004-cli identity get 634
```

## Search identities by owner

```bash
erc8004-cli identity list --owner 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --limit 20
```

This is the most reliable way to enumerate an owner's agents.

## Resolve canonical identifiers

Identifier format:

```text
<registryAddress>:<agentId>
```

Example:

```bash
erc8004-cli discovery resolve 0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:634
```

## Search by metadata/service

```bash
erc8004-cli discovery search --name assistant --limit 10
erc8004-cli discovery search --service mcp --limit 10
```

## Troubleshooting

### `ENUMERATION_UNSUPPORTED`

Some registries do not support ERC-721 enumerable functions (`totalSupply`, `tokenByIndex`, etc.).

If unfiltered listing fails:

```bash
erc8004-cli identity list --limit 20
```

switch to one of these:

- `identity get <agentId>`
- `identity list --owner <address>`
- `discovery search ...`
