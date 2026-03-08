import type { Abi } from 'viem';
import clFactoryAbiJson from './abis/CLFactory.abi.json' with { type: 'json' };
import clPoolAbiJson from './abis/CLPool.abi.json' with { type: 'json' };
import gaugeAbiJson from './abis/Gauge.abi.json' with { type: 'json' };
import minterAbiJson from './abis/Minter.abi.json' with { type: 'json' };
import nonfungiblePositionManagerAbiJson from './abis/NonfungiblePositionManager.abi.json' with {
  type: 'json',
};
import poolFactoryAbiJson from './abis/PoolFactory.abi.json' with { type: 'json' };
import quoterV2AbiJson from './abis/QuoterV2.abi.json' with { type: 'json' };
import rewardsDistributorAbiJson from './abis/RewardsDistributor.abi.json' with { type: 'json' };
import swapRouterAbiJson from './abis/SwapRouter.abi.json' with { type: 'json' };
import voterAbiJson from './abis/Voter.abi.json' with { type: 'json' };
import votingEscrowAbiJson from './abis/VotingEscrow.abi.json' with { type: 'json' };
import votingRewardAbiJson from './abis/VotingReward.abi.json' with { type: 'json' };

export const clFactoryAbi = clFactoryAbiJson as Abi;
export const clPoolAbi = clPoolAbiJson as Abi;
export const gaugeAbi = gaugeAbiJson as Abi;
export const minterAbi = minterAbiJson as Abi;
export const nonfungiblePositionManagerAbi = nonfungiblePositionManagerAbiJson as Abi;
export const poolFactoryAbi = poolFactoryAbiJson as Abi;
export const quoterV2Abi = quoterV2AbiJson as Abi;
export const rewardsDistributorAbi = rewardsDistributorAbiJson as Abi;
export const swapRouterAbi = swapRouterAbiJson as Abi;
export const voterAbi = voterAbiJson as Abi;
export const votingEscrowAbi = votingEscrowAbiJson as Abi;
export const votingRewardAbi = votingRewardAbiJson as Abi;
