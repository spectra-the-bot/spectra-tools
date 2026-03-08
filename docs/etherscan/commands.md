# etherscan

## etherscan account

Query account balances, transactions, and token transfers.

### etherscan account balance

Get the native-token balance of an address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Wallet address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `wei` | `string` | yes |  |
| `eth` | `string` | yes |  |
| `chain` | `string` | yes |  |

#### Examples

```sh
# Get ETH balance on Abstract
etherscan account balance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain abstract
```

### etherscan account tokenbalance

Get ERC-20 token balance for an address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Wallet address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--contractaddress` | `string` |  | Token contract address |
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `contract` | `string` | yes |  |
| `balance` | `string` | yes |  |
| `chain` | `string` | yes |  |

#### Examples

```sh
# Get token balance for a wallet + token pair
etherscan account tokenbalance 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --contractaddress 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

### etherscan account tokentx

List ERC-20 token transfers for an address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Wallet address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--contractaddress` | `string` |  | Filter by token contract address |
| `--page` | `number` | `1` | Page number |
| `--offset` | `number` | `20` | Results per page |
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `chain` | `string` | yes |  |
| `count` | `number` | yes |  |
| `transfers` | `array` | yes |  |
| `transfers[].hash` | `string` | yes |  |
| `transfers[].from` | `string` | yes |  |
| `transfers[].to` | `string` | yes |  |
| `transfers[].value` | `string` | yes |  |
| `transfers[].token` | `string` | yes |  |
| `transfers[].tokenName` | `string` | yes |  |
| `transfers[].decimals` | `string` | yes |  |
| `transfers[].timestamp` | `string` | yes |  |
| `transfers[].contract` | `string` | yes |  |

#### Examples

```sh
# List recent ERC-20 transfers for an address
etherscan account tokentx 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain base --offset 10
```

### etherscan account txlist

List normal transactions for an address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Wallet address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--startblock` | `number` | `0` | Start block number |
| `--endblock` | `string` | `latest` | End block number |
| `--page` | `number` | `1` | Page number |
| `--offset` | `number` | `10` | Number of results per page |
| `--sort` | `string` | `asc` | Sort order (asc or desc) |
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `chain` | `string` | yes |  |
| `count` | `number` | yes |  |
| `transactions` | `array` | yes |  |
| `transactions[].hash` | `string` | yes |  |
| `transactions[].from` | `string` | yes |  |
| `transactions[].to` | `string` | yes |  |
| `transactions[].value` | `string` | yes |  |
| `transactions[].eth` | `string` | yes |  |
| `transactions[].timestamp` | `string` | yes |  |
| `transactions[].block` | `string` | yes |  |
| `transactions[].status` | `string` | yes |  |
| `transactions[].gasUsed` | `string` | yes |  |

#### Examples

```sh
# List most recent transactions for an address
etherscan account txlist 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 --chain ethereum --sort desc --offset 5
```

## etherscan contract

Query contract ABI, source code, and deployment metadata.

### etherscan contract abi

Get the ABI for a verified contract.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Contract address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `chain` | `string` | yes |  |
| `abi` | `array` | yes |  |

#### Examples

```sh
# Fetch ABI for a verified ERC-20 contract
etherscan contract abi 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

### etherscan contract creation

Get the deployment transaction and creator for a contract.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Contract address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `creator` | `string` | yes |  |
| `txHash` | `string` | yes |  |
| `chain` | `string` | yes |  |

#### Examples

```sh
# Find deployment tx for a contract
etherscan contract creation 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

### etherscan contract source

Get verified source code for a contract.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Contract address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `chain` | `string` | yes |  |
| `name` | `string` | yes |  |
| `compiler` | `string` | yes |  |
| `optimized` | `boolean` | yes |  |
| `runs` | `string` | yes |  |
| `license` | `string` | yes |  |
| `proxy` | `boolean` | yes |  |
| `implementation` | `string` | no |  |
| `sourceCode` | `string` | yes |  |
| `constructorArguments` | `string` | yes |  |

#### Examples

```sh
# Fetch verified source code metadata
etherscan contract source 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

## etherscan gas

Query gas oracle data and estimate confirmation latency.

### etherscan gas estimate

Estimate confirmation time in seconds for a gas price (wei).

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--gasprice` | `string` |  | Gas price in wei |
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chain` | `string` | yes |  |
| `gasprice` | `string` | yes |  |
| `estimatedSeconds` | `string` | yes |  |

#### Examples

```sh
# Estimate confirmation time at 1 gwei
etherscan gas estimate --gasprice 1000000000 --chain ethereum
```

### etherscan gas oracle

Get current gas price recommendations.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chain` | `string` | yes |  |
| `lastBlock` | `string` | yes |  |
| `slow` | `string` | yes |  |
| `standard` | `string` | yes |  |
| `fast` | `string` | yes |  |
| `baseFee` | `string` | yes |  |
| `gasUsedRatio` | `string` | yes |  |

#### Examples

```sh
# Get gas oracle on Abstract
etherscan gas oracle --chain abstract
```

## etherscan stats

Query ETH price and total supply statistics.

### etherscan stats ethprice

Get latest ETH price in USD and BTC.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chain` | `string` | yes |  |
| `usd` | `string` | yes |  |
| `btc` | `string` | yes |  |
| `usdTimestamp` | `string` | yes |  |
| `btcTimestamp` | `string` | yes |  |

#### Examples

```sh
# Get ETH spot price on Ethereum
etherscan stats ethprice --chain ethereum
```

### etherscan stats ethsupply

Get total ETH supply in wei.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `chain` | `string` | yes |  |
| `totalSupplyWei` | `string` | yes |  |

#### Examples

```sh
# Get total ETH supply
etherscan stats ethsupply --chain ethereum
```

## etherscan token

Query token metadata, holders, and supply.

### etherscan token holders

List top token holders.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `contractaddress` | `string` | yes | Token contract address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--page` | `number` | `1` | Page number |
| `--offset` | `number` | `10` | Results per page |
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contractAddress` | `string` | yes |  |
| `chain` | `string` | yes |  |
| `count` | `number` | yes |  |
| `holders` | `array` | yes |  |
| `holders[].rank` | `number` | yes |  |
| `holders[].address` | `string` | yes |  |
| `holders[].quantity` | `string` | yes |  |

#### Examples

```sh
# List top 20 holders for a token
etherscan token holders 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --page 1 --offset 20 --chain ethereum
```

### etherscan token info

Get metadata for a token contract.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `contractaddress` | `string` | yes | Token contract address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `chain` | `string` | yes |  |
| `name` | `string` | yes |  |
| `symbol` | `string` | yes |  |
| `type` | `string` | yes |  |
| `totalSupply` | `string` | yes |  |
| `decimals` | `string` | yes |  |
| `priceUsd` | `string` | no |  |
| `website` | `string` | no |  |
| `description` | `string` | no |  |

#### Examples

```sh
# Get token metadata for USDC
etherscan token info 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

### etherscan token supply

Get total token supply.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `contractaddress` | `string` | yes | Token contract address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contractAddress` | `string` | yes |  |
| `chain` | `string` | yes |  |
| `totalSupply` | `string` | yes |  |

#### Examples

```sh
# Get total supply for a token
etherscan token supply 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 --chain ethereum
```

## etherscan tx

Query transaction details, receipts, and execution status.

### etherscan tx info

Get transaction details by hash.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `txhash` | `string` | yes | Transaction hash |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hash` | `string` | yes |  |
| `from` | `string` | yes |  |
| `to` | `unknown` | yes |  |
| `value` | `string` | yes |  |
| `gas` | `string` | yes |  |
| `gasPrice` | `string` | yes |  |
| `nonce` | `string` | yes |  |
| `block` | `string` | yes |  |
| `chain` | `string` | yes |  |

#### Examples

```sh
# Inspect one transaction on Abstract
etherscan tx info 0x1234...abcd --chain abstract
```

### etherscan tx receipt

Get the receipt for a transaction.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `txhash` | `string` | yes | Transaction hash |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hash` | `string` | yes |  |
| `block` | `string` | yes |  |
| `from` | `string` | yes |  |
| `to` | `unknown` | yes |  |
| `status` | `string` | yes |  |
| `gasUsed` | `string` | yes |  |
| `contractAddress` | `unknown` | yes |  |
| `logCount` | `number` | yes |  |
| `chain` | `string` | yes |  |

#### Examples

```sh
# Get receipt details including status and logs
etherscan tx receipt 0x1234...abcd --chain ethereum
```

### etherscan tx status

Check whether a transaction succeeded or failed.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `txhash` | `string` | yes | Transaction hash |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ETHERSCAN_API_KEY` | `string` | yes |  | Etherscan V2 API key |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--chain` | `string` | `abstract` | Chain name (abstract, ethereum, base, arbitrum, ...) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `hash` | `string` | yes |  |
| `status` | `string` | yes |  |
| `error` | `string` | no |  |
| `chain` | `string` | yes |  |

#### Examples

```sh
# Get pass/fail status for a transaction
etherscan tx status 0x1234...abcd --chain base
```
