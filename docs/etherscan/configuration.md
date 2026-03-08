# Etherscan CLI Configuration

`@spectratools/etherscan-cli` uses the Etherscan V2 API and requires an API key.

## `ETHERSCAN_API_KEY` (required)

| Variable | Required | Description |
|----------|----------|-------------|
| `ETHERSCAN_API_KEY` | **Yes** | Etherscan V2 API key used by every command |

```bash
export ETHERSCAN_API_KEY="your-etherscan-api-key"
```

### How to get an API key

1. Sign in or create an account at [etherscan.io](https://etherscan.io)
2. Open [etherscan.io/myapikey](https://etherscan.io/myapikey)
3. Create an API key
4. Store it in your shell profile or CI secret manager

## Chain selection (`--chain`)

All commands accept `--chain`:

```bash
etherscan-cli account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum
```

Default chain is **Abstract**:

```bash
etherscan-cli gas oracle
# same as: etherscan-cli gas oracle --chain abstract
```

### Supported chains

- `abstract` (default)
- `ethereum` (alias: `mainnet`)
- `base`
- `arbitrum`
- `optimism`
- `polygon`
- `avalanche`
- `bsc`
- `linea`
- `scroll`
- `zksync`
- `mantle`
- `blast`
- `mode`
- `sepolia`
- `goerli`

## Output formats

Use `--format` on any command:

```bash
--format <toon|json|yaml|md|jsonl>
```

| Format | Best for |
|--------|----------|
| `toon` | Human-readable terminal output (default) |
| `json` | Scripts and AI agent workflows |
| `yaml` | Human-readable structured output |
| `md` | Markdown reports and notes |
| `jsonl` | Streaming and line-oriented processing |

Examples:

```bash
# Structured machine output
etherscan-cli tx status 0x1234...abcd --chain ethereum --format json

# Full envelope + metadata
etherscan-cli tx status 0x1234...abcd --chain ethereum --format json --verbose
```
