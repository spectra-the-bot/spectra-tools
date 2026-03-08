# ERC-8004 CLI Configuration

`@spectratools/erc8004-cli` defaults to Abstract mainnet, but can be configured with environment variables.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `ABSTRACT_RPC_URL` | No | `https://api.mainnet.abs.xyz` | Optional RPC override; otherwise uses the public Abstract RPC |
| `IDENTITY_REGISTRY_ADDRESS` | No | `0x8004a169fb4a3325136eb29fa0ceb6d2e539a432` | Optional identity registry override |
| `REPUTATION_REGISTRY_ADDRESS` | No | `0x8004baa17c55a88189ae136b182e5fda19de9b63` | Optional reputation registry override |
| `VALIDATION_REGISTRY_ADDRESS` | No | `0x8004cc8439f36fd5f9f049d9ff86523df6daab58` | Optional validation registry override |
| `IPFS_GATEWAY` | No | `https://ipfs.io` | Optional gateway for resolving `ipfs://` registration URIs |
| `PRIVATE_KEY` | Required for write ops | — | `0x`-prefixed key for signing transactions |

## Typical setup

Read-only queries work without `PRIVATE_KEY`:

```bash
erc8004-cli identity get 634
```

For write operations, export a signer key first:

```bash
export PRIVATE_KEY=0xYOUR_PRIVATE_KEY
erc8004-cli identity register --uri ipfs://bafy...
```

## Optional overrides

```bash
export ABSTRACT_RPC_URL=https://api.mainnet.abs.xyz
export IDENTITY_REGISTRY_ADDRESS=0x...
export REPUTATION_REGISTRY_ADDRESS=0x...
export VALIDATION_REGISTRY_ADDRESS=0x...
export IPFS_GATEWAY=https://ipfs.io
```

`reputation` and `validation` commands also support `--registry` per command:

```bash
erc8004-cli reputation get 634 --registry 0x...
erc8004-cli validation status 12 --registry 0x...
```
