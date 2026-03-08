# Guide: Contract Investigation

This workflow shows how to investigate a contract end-to-end with `etherscan-cli`.

## Prerequisites

```bash
export ETHERSCAN_API_KEY="your-etherscan-api-key"
CHAIN=ethereum
CONTRACT=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

## 1) Get ABI

```bash
etherscan-cli contract abi "$CONTRACT" --chain "$CHAIN" --format json
```

Use the ABI to inspect available methods/events and power decoders.

## 2) Get verified source

```bash
etherscan-cli contract source "$CONTRACT" --chain "$CHAIN" --format json
```

Check key metadata:
- compiler version
- optimization settings
- license
- proxy/implementation fields
- constructor arguments

## 3) Find creation tx and deployer

```bash
etherscan-cli contract creation "$CONTRACT" --chain "$CHAIN" --format json
```

This returns:
- `creator` (deployer address)
- `txHash` (creation transaction)

## 4) Verify transaction execution

```bash
TX_HASH=<creation-tx-hash>

etherscan-cli tx receipt "$TX_HASH" --chain "$CHAIN" --format json
etherscan-cli tx status "$TX_HASH" --chain "$CHAIN" --format json
```

Use receipt + status to confirm success/failure and inspect gas/log behavior.

## 5) (Optional) Verify token-level metadata

If the contract is an ERC-20, validate token details and holder distribution:

```bash
etherscan-cli token info "$CONTRACT" --chain "$CHAIN" --format json
etherscan-cli token holders "$CONTRACT" --chain "$CHAIN" --offset 20 --format json
```

## Quick checklist

- ABI exists and matches expected interface
- Source is verified
- Creation tx exists and succeeded
- Deployer activity looks expected
- Token metadata/holders look sane (if token)
