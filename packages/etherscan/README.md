# @spectra-the-bot/etherscan-cli

Etherscan V2 API CLI built with [incur](https://github.com/wevm/incur). Supports 60+ chains including Abstract (2741).

## Setup

```bash
export ETHERSCAN_API_KEY=your_api_key
```

## Commands

### Account

```bash
# ETH balance
etherscan-cli account balance <address> [--chain abstract]

# Transaction list
etherscan-cli account txlist <address> [--startblock 0] [--endblock latest] [--page 1] [--offset 10] [--sort asc]

# ERC-20 token transfers
etherscan-cli account tokentx <address> [--contractaddress 0x...] [--chain abstract]

# ERC-20 token balance
etherscan-cli account tokenbalance <address> --contractaddress <0x...> [--chain abstract]
```

### Contract

```bash
# ABI (verified contracts only)
etherscan-cli contract abi <address> [--chain abstract]

# Verified source code
etherscan-cli contract source <address> [--chain abstract]

# Deployment transaction
etherscan-cli contract creation <address> [--chain abstract]
```

### Transaction

```bash
etherscan-cli tx info <txhash> [--chain abstract]
etherscan-cli tx receipt <txhash> [--chain abstract]
etherscan-cli tx status <txhash> [--chain abstract]
```

### Token

```bash
etherscan-cli token info <contractaddress> [--chain abstract]
etherscan-cli token holders <contractaddress> [--page 1] [--offset 10] [--chain abstract]
etherscan-cli token supply <contractaddress> [--chain abstract]
```

### Gas

```bash
etherscan-cli gas oracle [--chain abstract]
etherscan-cli gas estimate --gasprice <wei> [--chain abstract]
```

### Stats

```bash
etherscan-cli stats ethprice [--chain abstract]
etherscan-cli stats ethsupply [--chain abstract]
```

## Supported Chains

| Name | Chain ID |
|------|----------|
| abstract | 2741 |
| ethereum / mainnet | 1 |
| base | 8453 |
| arbitrum | 42161 |
| optimism | 10 |
| polygon | 137 |
| avalanche | 43114 |
| bsc | 56 |
| linea | 59144 |
| scroll | 534352 |
| zksync | 324 |
| mantle | 5000 |
| blast | 81457 |
| mode | 34443 |
| sepolia | 11155111 |

## Rate Limiting

The free Etherscan API tier allows 5 requests/second. The CLI enforces this automatically using a token-bucket rate limiter from `@spectra-the-bot/cli-shared`.

## Output Formats

```bash
# Human-readable (default)
etherscan-cli account balance 0x...

# JSON (for piping/agents)
etherscan-cli account balance 0x... --json
```
