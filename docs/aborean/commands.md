# aborean

## aborean cl

Concentrated liquidity (Slipstream) pools, positions, and quotes.

### aborean cl pool

Get detailed state for a Slipstream pool address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pool` | `string` | yes | Pool address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pool` | `object` | yes |  |
| `pool.pool` | `string` | yes |  |
| `pool.pair` | `string` | yes |  |
| `pool.token0` | `object` | yes |  |
| `pool.token0.address` | `string` | yes |  |
| `pool.token0.symbol` | `string` | yes |  |
| `pool.token0.decimals` | `number` | yes |  |
| `pool.token1` | `object` | yes |  |
| `pool.token1.address` | `string` | yes |  |
| `pool.token1.symbol` | `string` | yes |  |
| `pool.token1.decimals` | `number` | yes |  |
| `pool.fee` | `number` | yes |  |
| `pool.feePercent` | `number` | yes |  |
| `pool.tickSpacing` | `number` | yes |  |
| `pool.liquidity` | `string` | yes |  |
| `pool.currentTick` | `number` | yes |  |
| `pool.sqrtPriceX96` | `string` | yes |  |
| `pool.activeLiquidityEstimate` | `object` | yes |  |
| `pool.activeLiquidityEstimate.token0` | `string` | yes |  |
| `pool.activeLiquidityEstimate.token1` | `string` | yes |  |
| `pool.activeLiquidityEstimate.totalInToken0` | `unknown` | yes |  |
| `pool.activeLiquidityEstimate.totalInToken1` | `unknown` | yes |  |
| `pool.price` | `object` | yes |  |
| `pool.price.token1PerToken0` | `unknown` | yes |  |
| `pool.price.token0PerToken1` | `unknown` | yes |  |

### aborean cl pools

List Slipstream pools with current state, prices, and active liquidity estimate.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `count` | `number` | yes |  |
| `pools` | `array` | yes |  |
| `pools[].pool` | `string` | yes |  |
| `pools[].pair` | `string` | yes |  |
| `pools[].token0` | `object` | yes |  |
| `pools[].token0.address` | `string` | yes |  |
| `pools[].token0.symbol` | `string` | yes |  |
| `pools[].token0.decimals` | `number` | yes |  |
| `pools[].token1` | `object` | yes |  |
| `pools[].token1.address` | `string` | yes |  |
| `pools[].token1.symbol` | `string` | yes |  |
| `pools[].token1.decimals` | `number` | yes |  |
| `pools[].fee` | `number` | yes |  |
| `pools[].feePercent` | `number` | yes |  |
| `pools[].tickSpacing` | `number` | yes |  |
| `pools[].liquidity` | `string` | yes |  |
| `pools[].currentTick` | `number` | yes |  |
| `pools[].sqrtPriceX96` | `string` | yes |  |
| `pools[].activeLiquidityEstimate` | `object` | yes |  |
| `pools[].activeLiquidityEstimate.token0` | `string` | yes |  |
| `pools[].activeLiquidityEstimate.token1` | `string` | yes |  |
| `pools[].activeLiquidityEstimate.totalInToken0` | `unknown` | yes |  |
| `pools[].activeLiquidityEstimate.totalInToken1` | `unknown` | yes |  |
| `pools[].price` | `object` | yes |  |
| `pools[].price.token1PerToken0` | `unknown` | yes |  |
| `pools[].price.token0PerToken1` | `unknown` | yes |  |

### aborean cl positions

List concentrated liquidity NFT positions for an owner.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `owner` | `string` | yes | Owner wallet address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `owner` | `string` | yes |  |
| `count` | `number` | yes |  |
| `positions` | `array` | yes |  |
| `positions[].tokenId` | `string` | yes |  |
| `positions[].pair` | `string` | yes |  |
| `positions[].token0` | `object` | yes |  |
| `positions[].token0.address` | `string` | yes |  |
| `positions[].token0.symbol` | `string` | yes |  |
| `positions[].token0.decimals` | `number` | yes |  |
| `positions[].token1` | `object` | yes |  |
| `positions[].token1.address` | `string` | yes |  |
| `positions[].token1.symbol` | `string` | yes |  |
| `positions[].token1.decimals` | `number` | yes |  |
| `positions[].tickSpacing` | `number` | yes |  |
| `positions[].tickLower` | `number` | yes |  |
| `positions[].tickUpper` | `number` | yes |  |
| `positions[].liquidity` | `string` | yes |  |
| `positions[].tokensOwed0` | `object` | yes |  |
| `positions[].tokensOwed0.raw` | `string` | yes |  |
| `positions[].tokensOwed0.decimal` | `string` | yes |  |
| `positions[].tokensOwed1` | `object` | yes |  |
| `positions[].tokensOwed1.raw` | `string` | yes |  |
| `positions[].tokensOwed1.decimal` | `string` | yes |  |

### aborean cl quote

Quote a single-hop Slipstream swap via QuoterV2.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tokenIn` | `string` | yes | Input token address |
| `tokenOut` | `string` | yes | Output token address |
| `amountIn` | `string` | yes | Input amount in human-readable decimal units |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--fee` | `number` |  | Optional fee tier filter |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pool` | `string` | yes |  |
| `selectedFee` | `number` | yes |  |
| `selectedTickSpacing` | `number` | yes |  |
| `tokenIn` | `object` | yes |  |
| `tokenIn.address` | `string` | yes |  |
| `tokenIn.symbol` | `string` | yes |  |
| `tokenIn.decimals` | `number` | yes |  |
| `tokenOut` | `object` | yes |  |
| `tokenOut.address` | `string` | yes |  |
| `tokenOut.symbol` | `string` | yes |  |
| `tokenOut.decimals` | `number` | yes |  |
| `amountIn` | `object` | yes |  |
| `amountIn.raw` | `string` | yes |  |
| `amountIn.decimal` | `string` | yes |  |
| `amountOut` | `object` | yes |  |
| `amountOut.raw` | `string` | yes |  |
| `amountOut.decimal` | `string` | yes |  |
| `execution` | `object` | yes |  |
| `execution.sqrtPriceX96After` | `string` | yes |  |
| `execution.initializedTicksCrossed` | `number` | yes |  |
| `execution.gasEstimate` | `string` | yes |  |
| `prices` | `object` | yes |  |
| `prices.poolMidPriceOutPerIn` | `unknown` | yes |  |
| `prices.quotePriceOutPerIn` | `unknown` | yes |  |
| `prices.priceImpactPct` | `unknown` | yes |  |

## aborean gauges

Inspect Aborean gauge emissions, staking, and user positions.

### aborean gauges info

Get detailed state for one gauge address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `gauge` | `string` | yes | Gauge contract address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gauge` | `string` | yes |  |
| `pool` | `string` | yes |  |
| `isAlive` | `boolean` | yes |  |
| `stakingToken` | `string` | yes |  |
| `rewardToken` | `string` | yes |  |
| `totalStaked` | `string` | yes |  |
| `rewardRate` | `string` | yes |  |
| `rewardPerTokenStored` | `string` | yes |  |
| `fees0` | `string` | yes |  |
| `fees1` | `string` | yes |  |
| `left` | `string` | yes |  |
| `periodFinish` | `number` | yes |  |
| `periodFinishRelative` | `string` | yes |  |
| `lastUpdateTime` | `number` | yes |  |
| `bribeContract` | `string` | yes |  |
| `feeContract` | `string` | yes |  |

#### Examples

```sh
# Inspect one gauge in detail
aborean gauges info 0x0000000000000000000000000000000000000001
```

### aborean gauges list

List active gauges with pool, emissions, and staking stats.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `gauges` | `array` | yes |  |
| `gauges[].pool` | `string` | yes |  |
| `gauges[].gauge` | `string` | yes |  |
| `gauges[].rewardToken` | `string` | yes |  |
| `gauges[].rewardRate` | `string` | yes |  |
| `gauges[].totalStaked` | `string` | yes |  |
| `gauges[].claimableEmissions` | `string` | yes |  |
| `gauges[].periodFinish` | `number` | yes |  |
| `gauges[].periodFinishRelative` | `string` | yes |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List all active gauges and current emissions state
aborean gauges list
```

### aborean gauges staked

Show one address staking positions across all gauges.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Wallet address to inspect |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `positions` | `array` | yes |  |
| `positions[].pool` | `string` | yes |  |
| `positions[].gauge` | `string` | yes |  |
| `positions[].rewardToken` | `string` | yes |  |
| `positions[].staked` | `string` | yes |  |
| `positions[].earned` | `string` | yes |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List gauge positions for a wallet
aborean gauges staked 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

## aborean lending

Inspect Morpho lending markets on Abstract.

### aborean lending market

Get details for one Morpho market id (bytes32).

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `marketId` | `string` | yes | Morpho market id (bytes32 hex) |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `marketId` | `string` | yes |  |
| `loanToken` | `object` | yes |  |
| `loanToken.address` | `string` | yes |  |
| `loanToken.symbol` | `string` | yes |  |
| `loanToken.decimals` | `number` | yes |  |
| `collateralToken` | `object` | yes |  |
| `collateralToken.address` | `string` | yes |  |
| `collateralToken.symbol` | `string` | yes |  |
| `collateralToken.decimals` | `number` | yes |  |
| `oracle` | `string` | yes |  |
| `irm` | `string` | yes |  |
| `lltvBps` | `number` | yes |  |
| `lltvPercent` | `number` | yes |  |
| `totalSupplyAssets` | `string` | yes |  |
| `totalBorrowAssets` | `string` | yes |  |
| `totalSupplyShares` | `string` | yes |  |
| `totalBorrowShares` | `string` | yes |  |
| `availableLiquidityAssets` | `string` | yes |  |
| `utilization` | `unknown` | yes |  |
| `feeWad` | `string` | yes |  |
| `lastUpdate` | `number` | yes |  |

#### Examples

```sh
# Inspect one Morpho market by id
aborean lending market 0xfe1d7da2fbde85b1fee120c88df3e6b55164a2442dab97486d3d4f719a5ff1fb
```

### aborean lending markets

List Morpho markets discovered from CreateMarket events.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `limit` | `number` | yes | Max markets to return |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `morpho` | `string` | yes |  |
| `marketCount` | `number` | yes |  |
| `markets` | `array` | yes |  |
| `markets[].marketId` | `string` | yes |  |
| `markets[].loanToken` | `object` | yes |  |
| `markets[].loanToken.address` | `string` | yes |  |
| `markets[].loanToken.symbol` | `string` | yes |  |
| `markets[].loanToken.decimals` | `number` | yes |  |
| `markets[].collateralToken` | `object` | yes |  |
| `markets[].collateralToken.address` | `string` | yes |  |
| `markets[].collateralToken.symbol` | `string` | yes |  |
| `markets[].collateralToken.decimals` | `number` | yes |  |
| `markets[].oracle` | `string` | yes |  |
| `markets[].irm` | `string` | yes |  |
| `markets[].lltvBps` | `number` | yes |  |
| `markets[].lltvPercent` | `number` | yes |  |
| `markets[].totalSupplyAssets` | `string` | yes |  |
| `markets[].totalBorrowAssets` | `string` | yes |  |
| `markets[].totalSupplyShares` | `string` | yes |  |
| `markets[].totalBorrowShares` | `string` | yes |  |
| `markets[].availableLiquidityAssets` | `string` | yes |  |
| `markets[].utilization` | `unknown` | yes |  |
| `markets[].feeWad` | `string` | yes |  |
| `markets[].lastUpdate` | `number` | yes |  |
| `totalsByLoanToken` | `array` | yes |  |
| `totalsByLoanToken[].token` | `string` | yes |  |
| `totalsByLoanToken[].symbol` | `string` | yes |  |
| `totalsByLoanToken[].decimals` | `number` | yes |  |
| `totalsByLoanToken[].totalSupplyAssets` | `string` | yes |  |
| `totalsByLoanToken[].totalBorrowAssets` | `string` | yes |  |

#### Examples

```sh
# List active Morpho markets on Abstract
aborean lending markets
```

### aborean lending position

Inspect one user position in a Morpho market.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `marketId` | `string` | yes | Morpho market id (bytes32 hex) |
| `user` | `string` | yes | Position owner address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `marketId` | `string` | yes |  |
| `user` | `string` | yes |  |
| `loanToken` | `object` | yes |  |
| `loanToken.address` | `string` | yes |  |
| `loanToken.symbol` | `string` | yes |  |
| `loanToken.decimals` | `number` | yes |  |
| `collateralToken` | `object` | yes |  |
| `collateralToken.address` | `string` | yes |  |
| `collateralToken.symbol` | `string` | yes |  |
| `collateralToken.decimals` | `number` | yes |  |
| `supplyShares` | `string` | yes |  |
| `supplyAssetsEstimate` | `object` | yes |  |
| `supplyAssetsEstimate.raw` | `string` | yes |  |
| `supplyAssetsEstimate.decimal` | `string` | yes |  |
| `borrowShares` | `string` | yes |  |
| `borrowAssetsEstimate` | `object` | yes |  |
| `borrowAssetsEstimate.raw` | `string` | yes |  |
| `borrowAssetsEstimate.decimal` | `string` | yes |  |
| `collateralAssets` | `object` | yes |  |
| `collateralAssets.raw` | `string` | yes |  |
| `collateralAssets.decimal` | `string` | yes |  |

#### Examples

```sh
# Inspect one user position in a market
aborean lending position 0xfe1d7da2fbde85b1fee120c88df3e6b55164a2442dab97486d3d4f719a5ff1fb 0x0000000000000000000000000000000000000000
```

## aborean pools

Inspect V2 AMM pools, reserves, quotes, and fee configuration.

### aborean pools fees

Read V2 fee configuration for a pool address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pool` | `string` | yes | Pool address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pool` | `string` | yes |  |
| `pair` | `string` | yes |  |
| `stable` | `boolean` | yes |  |
| `activeFee` | `unknown` | yes |  |
| `stableFee` | `unknown` | yes |  |
| `volatileFee` | `unknown` | yes |  |

### aborean pools list

List V2 pools with token pairs, reserves, and stable/volatile type.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--offset` | `number` | `0` | Pool index offset |
| `--limit` | `number` | `50` | Maximum pools to return (max 500) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `total` | `number` | yes |  |
| `offset` | `number` | yes |  |
| `limit` | `number` | yes |  |
| `count` | `number` | yes |  |
| `pools` | `array` | yes |  |
| `pools[].pool` | `string` | yes |  |
| `pools[].pair` | `string` | yes |  |
| `pools[].stable` | `boolean` | yes |  |
| `pools[].poolType` | `string` | yes |  |
| `pools[].token0` | `object` | yes |  |
| `pools[].token0.address` | `string` | yes |  |
| `pools[].token0.symbol` | `string` | yes |  |
| `pools[].token0.decimals` | `number` | yes |  |
| `pools[].token1` | `object` | yes |  |
| `pools[].token1.address` | `string` | yes |  |
| `pools[].token1.symbol` | `string` | yes |  |
| `pools[].token1.decimals` | `number` | yes |  |
| `pools[].reserves` | `object` | yes |  |
| `pools[].reserves.token0` | `object` | yes |  |
| `pools[].reserves.token0.raw` | `string` | yes |  |
| `pools[].reserves.token0.decimal` | `string` | yes |  |
| `pools[].reserves.token1` | `object` | yes |  |
| `pools[].reserves.token1.raw` | `string` | yes |  |
| `pools[].reserves.token1.decimal` | `string` | yes |  |
| `pools[].reserves.blockTimestampLast` | `number` | yes |  |
| `pools[].totalSupply` | `string` | yes |  |
| `pools[].fee` | `unknown` | yes |  |

### aborean pools pool

Get detailed state for one V2 pool.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Pool address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pool` | `object` | yes |  |
| `pool.pool` | `string` | yes |  |
| `pool.pair` | `string` | yes |  |
| `pool.stable` | `boolean` | yes |  |
| `pool.poolType` | `string` | yes |  |
| `pool.token0` | `object` | yes |  |
| `pool.token0.address` | `string` | yes |  |
| `pool.token0.symbol` | `string` | yes |  |
| `pool.token0.decimals` | `number` | yes |  |
| `pool.token1` | `object` | yes |  |
| `pool.token1.address` | `string` | yes |  |
| `pool.token1.symbol` | `string` | yes |  |
| `pool.token1.decimals` | `number` | yes |  |
| `pool.reserves` | `object` | yes |  |
| `pool.reserves.token0` | `object` | yes |  |
| `pool.reserves.token0.raw` | `string` | yes |  |
| `pool.reserves.token0.decimal` | `string` | yes |  |
| `pool.reserves.token1` | `object` | yes |  |
| `pool.reserves.token1.raw` | `string` | yes |  |
| `pool.reserves.token1.decimal` | `string` | yes |  |
| `pool.reserves.blockTimestampLast` | `number` | yes |  |
| `pool.totalSupply` | `string` | yes |  |
| `pool.fee` | `unknown` | yes |  |
| `pool.poolFees` | `string` | yes |  |
| `pool.factory` | `string` | yes |  |

### aborean pools quote

Quote a single-hop V2 swap between tokenIn and tokenOut.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tokenIn` | `string` | yes | Input token address |
| `tokenOut` | `string` | yes | Output token address |
| `amountIn` | `string` | yes | Input amount in human-readable decimal units |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--stable` | `boolean` | `false` | Use stable pool route (default: volatile) |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pool` | `string` | yes |  |
| `stable` | `boolean` | yes |  |
| `tokenIn` | `object` | yes |  |
| `tokenIn.address` | `string` | yes |  |
| `tokenIn.symbol` | `string` | yes |  |
| `tokenIn.decimals` | `number` | yes |  |
| `tokenOut` | `object` | yes |  |
| `tokenOut.address` | `string` | yes |  |
| `tokenOut.symbol` | `string` | yes |  |
| `tokenOut.decimals` | `number` | yes |  |
| `amountIn` | `object` | yes |  |
| `amountIn.raw` | `string` | yes |  |
| `amountIn.decimal` | `string` | yes |  |
| `amountOut` | `object` | yes |  |
| `amountOut.raw` | `string` | yes |  |
| `amountOut.decimal` | `string` | yes |  |
| `priceOutPerIn` | `unknown` | yes |  |

## aborean status

### aborean status

Cross-protocol Aborean snapshot (TVL estimates, epoch, top pools, ve lock, vaults, Morpho lending).

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `v2PoolCount` | `number` | yes | Number of V2 AMM pools |
| `clPoolCount` | `number` | yes | Number of Slipstream (CL) pools |
| `gaugeCount` | `number` | yes | Number of pools with gauges |
| `totalVotingWeight` | `string` | yes | Total voting weight (wei) |
| `veABXTotalSupply` | `string` | yes | Total veABX supply (wei) |
| `veABXLockedSupply` | `string` | yes | Total ABX locked in VotingEscrow (wei) |
| `epoch` | `object` | yes |  |
| `epoch.activePeriod` | `number` | yes |  |
| `epoch.epochEnd` | `number` | yes |  |
| `epoch.secondsRemaining` | `number` | yes |  |
| `epoch.epochCount` | `number` | yes |  |
| `epoch.weeklyEmission` | `string` | yes |  |
| `topPools` | `array` | yes |  |
| `topPools[].pool` | `string` | yes |  |
| `topPools[].pair` | `string` | yes |  |
| `topPools[].poolType` | `string` | yes |  |
| `topPools[].token0` | `object` | yes |  |
| `topPools[].token0.address` | `string` | yes |  |
| `topPools[].token0.symbol` | `string` | yes |  |
| `topPools[].token0.decimals` | `number` | yes |  |
| `topPools[].token1` | `object` | yes |  |
| `topPools[].token1.address` | `string` | yes |  |
| `topPools[].token1.symbol` | `string` | yes |  |
| `topPools[].token1.decimals` | `number` | yes |  |
| `topPools[].reserves` | `object` | yes |  |
| `topPools[].reserves.token0` | `string` | yes |  |
| `topPools[].reserves.token1` | `string` | yes |  |
| `topPools[].tvlEstimateUnits` | `number` | yes |  |
| `tvl` | `object` | yes |  |
| `tvl.v2ReserveUnitEstimate` | `number` | yes |  |
| `tvl.vaultManagedVotingPower` | `string` | yes |  |
| `vaults` | `object` | yes |  |
| `vaults.relayCount` | `number` | yes |  |
| `vaults.managedVotingPower` | `string` | yes |  |
| `vaults.note` | `unknown` | yes |  |
| `lending` | `object` | yes |  |
| `lending.available` | `boolean` | yes |  |
| `lending.morpho` | `string` | yes |  |
| `lending.marketCount` | `number` | yes |  |
| `lending.supplyByLoanToken` | `array` | yes |  |
| `lending.supplyByLoanToken[].token` | `string` | yes |  |
| `lending.supplyByLoanToken[].symbol` | `string` | yes |  |
| `lending.supplyByLoanToken[].decimals` | `number` | yes |  |
| `lending.supplyByLoanToken[].totalSupplyAssets` | `string` | yes |  |
| `lending.supplyByLoanToken[].totalBorrowAssets` | `string` | yes |  |
| `lending.note` | `unknown` | yes |  |

#### Examples

```sh
# Fetch the current Aborean protocol status
aborean status
```

## aborean vaults

Inspect Aborean relay vaults (auto-compounder / auto-converter).

### aborean vaults list

List known Aborean relay vaults with keeper and veNFT state.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `relayCount` | `number` | yes |  |
| `relays` | `array` | yes |  |
| `relays[].label` | `string` | yes |  |
| `relays[].relay` | `string` | yes |  |
| `relays[].name` | `string` | yes |  |
| `relays[].factoryType` | `string` | yes |  |
| `relays[].managedTokenId` | `string` | yes |  |
| `relays[].managedVotingPower` | `string` | yes |  |
| `relays[].relayToken` | `object` | yes |  |
| `relays[].relayToken.address` | `string` | yes |  |
| `relays[].relayToken.symbol` | `string` | yes |  |
| `relays[].relayToken.decimals` | `number` | yes |  |
| `relays[].relayTokenBalance` | `string` | yes |  |
| `relays[].keeperLastRun` | `number` | yes |  |
| `relays[].keeperLastRunRelative` | `string` | yes |  |
| `relays[].secondsSinceKeeperRun` | `number` | yes |  |
| `totals` | `object` | yes |  |
| `totals.managedVotingPower` | `string` | yes |  |
| `totals.relayTokenBalances` | `array` | yes |  |
| `totals.relayTokenBalances[].token` | `string` | yes |  |
| `totals.relayTokenBalances[].symbol` | `string` | yes |  |
| `totals.relayTokenBalances[].decimals` | `number` | yes |  |
| `totals.relayTokenBalances[].balance` | `string` | yes |  |

#### Examples

```sh
# List all known vault relays on Abstract
aborean vaults list
```

### aborean vaults relay

Inspect one relay vault by address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `relay` | `string` | yes | Relay vault contract address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | `string` | yes |  |
| `relay` | `string` | yes |  |
| `name` | `string` | yes |  |
| `factoryType` | `string` | yes |  |
| `managedTokenId` | `string` | yes |  |
| `managedVotingPower` | `string` | yes |  |
| `relayToken` | `object` | yes |  |
| `relayToken.address` | `string` | yes |  |
| `relayToken.symbol` | `string` | yes |  |
| `relayToken.decimals` | `number` | yes |  |
| `relayTokenBalance` | `string` | yes |  |
| `keeperLastRun` | `number` | yes |  |
| `keeperLastRunRelative` | `string` | yes |  |
| `secondsSinceKeeperRun` | `number` | yes |  |

#### Examples

```sh
# Inspect the veABX maxi relay
aborean vaults relay 0xcbeB1A72A31670AE5ba27798c124Fcf3Ca1971df
```

## aborean ve

Inspect Aborean VotingEscrow (veABX) global and per-NFT lock state.

### aborean ve lock

Get lock details and voting power for one veNFT token id.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tokenId` | `number` | yes | veNFT token id |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenId` | `number` | yes |  |
| `owner` | `string` | yes |  |
| `amount` | `string` | yes |  |
| `unlockTime` | `number` | yes |  |
| `isPermanent` | `boolean` | yes |  |
| `votingPower` | `string` | yes |  |

#### Examples

```sh
# Inspect lock details for veNFT #1
aborean ve lock 1
```

### aborean ve locks

List all veNFT locks owned by an address.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | yes | Owner address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | `string` | yes |  |
| `locks` | `array` | yes |  |
| `locks[].tokenId` | `string` | yes |  |
| `locks[].amount` | `string` | yes |  |
| `locks[].unlockTime` | `number` | yes |  |
| `locks[].isPermanent` | `boolean` | yes |  |
| `locks[].votingPower` | `string` | yes |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List all veNFT locks for an address
aborean ve locks 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

### aborean ve stats

Get global VotingEscrow supply, locks, and decay checkpoint data.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | `string` | yes |  |
| `totalVotingPower` | `string` | yes |  |
| `totalLocked` | `string` | yes |  |
| `permanentLocked` | `string` | yes |  |
| `epoch` | `number` | yes |  |
| `decayBias` | `string` | yes |  |
| `decaySlope` | `string` | yes |  |
| `lastCheckpointTimestamp` | `number` | yes |  |
| `lastCheckpointBlock` | `number` | yes |  |

#### Examples

```sh
# Show global veABX state and decay metrics
aborean ve stats
```

### aborean ve voting-power

Get current voting power for one veNFT token id.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tokenId` | `number` | yes | veNFT token id |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenId` | `number` | yes |  |
| `votingPower` | `string` | yes |  |

#### Examples

```sh
# Get current voting power for veNFT #1
aborean ve voting-power 1
```

## aborean voter

Inspect Aborean voter epoch, pool weights, and claimable rewards context.

### aborean voter bribes

Show active bribe reward tokens and current-epoch amounts for a pool.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pool` | `string` | yes | Pool address |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `pool` | `string` | yes |  |
| `gauge` | `string` | yes |  |
| `bribeContract` | `string` | yes |  |
| `epochStart` | `number` | yes |  |
| `rewardTokens` | `array` | yes |  |
| `rewardTokens[].token` | `string` | yes |  |
| `rewardTokens[].epochAmount` | `string` | yes |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# Inspect bribe reward tokens for one pool
aborean voter bribes 0x0000000000000000000000000000000000000001
```

### aborean voter epoch

Show current emissions epoch timing from Minter.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `activePeriod` | `number` | yes |  |
| `epochEnd` | `number` | yes |  |
| `secondsRemaining` | `number` | yes |  |
| `timeRemaining` | `string` | yes |  |
| `weekSeconds` | `number` | yes |  |
| `epochCount` | `number` | yes |  |
| `weeklyEmission` | `string` | yes |  |

#### Examples

```sh
# Inspect current voter epoch boundaries
aborean voter epoch
```

### aborean voter rewards

Show claimable rebase rewards and voting context for a veNFT.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tokenId` | `number` | yes | veNFT token id |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tokenId` | `number` | yes |  |
| `rewardToken` | `string` | yes |  |
| `claimableRebase` | `string` | yes |  |
| `timeCursor` | `number` | yes |  |
| `lastTokenTime` | `number` | yes |  |
| `distributorStartTime` | `number` | yes |  |
| `usedWeight` | `string` | yes |  |
| `lastVoted` | `number` | yes |  |

#### Examples

```sh
# Check claimable voter/distributor rewards
aborean voter rewards 1
```

### aborean voter weights

Show current pool voting weight distribution.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `ABSTRACT_RPC_URL` | `string` | no |  | Abstract RPC URL override |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `totalWeight` | `string` | yes |  |
| `pools` | `array` | yes |  |
| `pools[].pool` | `string` | yes |  |
| `pools[].gauge` | `string` | yes |  |
| `pools[].weight` | `string` | yes |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List all pools with non-zero voting weight
aborean voter weights
```
