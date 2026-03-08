/**
 * Aborean Finance — Abstract Mainnet contract addresses.
 *
 * V2 Core addresses sourced from:
 *   https://github.com/Aborean-Finance/aborean-contracts/blob/main/README.md
 *
 * Slipstream (CL) addresses sourced from:
 *   https://github.com/Aborean-Finance/aborean-slipstream/blob/main/README.md
 */

// ---------------------------------------------------------------------------
// V2 Core
// ---------------------------------------------------------------------------
export const ABOREAN_V2_ADDRESSES = {
  /** ABX protocol token (ERC-20) */
  abx: '0x4C68E4102c0F120cce9F08625bd12079806b7C4D',
  /** Airdrop distributor for permanently locked veNFTs */
  airdropDistributor: '0xd29d05bFfb2F0AfBB76ed217d726Ff5922253086',
  /** Registry of approved pool/gauge/reward factories */
  factoryRegistry: '0x5927E0C4b307Af16260327DE3276CE17d8A4aB49',
  /** Trusted forwarder */
  forwarder: '0x3f91b806F1968Fca85C08A7eE9A7262D7207A9c1',
  /** Gauge factory (v2) */
  gaugeFactory: '0x29BfEd845b1C10e427766b21d4533800B6f4e111',
  /** Managed rewards factory */
  managedRewardsFactory: '0x889d93f9c3586ec7CD287eE4e7C96E544985Ee95',
  /** Protocol token minter — distributes emissions to Voter and rebases to RewardsDistributor */
  minter: '0x58564Fcfc5a0C57887eFC0beDeC3EB5Ec37f1626',
  /** V2 Pool implementation */
  pool: '0x3E5791019A9Fae2805d69965b06dcEFC43Cd1A79',
  /** V2 Pool factory */
  poolFactory: '0xF6cDfFf7Ad51caaD860e7A35d6D4075d74039a6B',
  /** Rebases distribution for veNFT lockers */
  rewardsDistributor: '0x36cbf77D8F8355D7A077d670C29E290E41367072',
  /** V2 swap router */
  router: '0xE8142D2f82036B6FC1e79E4aE85cF53FBFfDC998',
  /** veNFT art proxy */
  veArtProxy: '0x53AF068205CB466d7Ce6e55fD1E64eB9eBcB7ce0',
  /** Handles votes, gauge creation, and emission distribution */
  voter: '0xC0F53703e9f4b79fA2FB09a2aeBA487FA97729c9',
  /** Vote-escrow NFT (veABX) */
  votingEscrow: '0x27B04370D8087e714a9f557c1EFF7901cea6bB63',
  /** Voting rewards factory */
  votingRewardsFactory: '0xCEf48ee1b2F7c0833D6F097c69D1ed4159b60958',
} as const;

// ---------------------------------------------------------------------------
// Slipstream (Concentrated Liquidity)
// ---------------------------------------------------------------------------
export const ABOREAN_CL_ADDRESSES = {
  /** CL pool factory */
  clFactory: '0x8cfE21F272FdFDdf42851f6282c0f998756eEf27',
  /** CL gauge factory */
  clGaugeFactory: '0xF0361d1aD99971791C002E9c281B18739e9abad8',
  /** CL gauge implementation */
  clGauge: '0xB037CBbD1208fBc58D3cAc91a22E55D7727ac2BF',
  /** CL pool implementation */
  clPool: '0x751C0c219Ef28A96d6B3926b8247fe508C4277BC',
  /** Custom swap fee module */
  customSwapFeeModule: '0xd09DCeeB71bF20FE229E0dd5D739060efFB60e14',
  /** Custom unstaked fee module */
  customUnstakedFeeModule: '0x2F59EC82D990DdbE501b2B5E9796e3d5BB45438F',
  /** Mixed-route quoter (v2 + CL paths) */
  mixedRouteQuoterV1: '0x9dB89879fEB50fDeAa52EF9a1235BAC242E4Efc7',
  /** NFT position manager for CL positions */
  nonfungiblePositionManager: '0xa4890B89dC628baE614780079ACc951Fb0ECdC5F',
  /** NFT position descriptor (metadata) */
  nonfungibleTokenPositionDescriptor: '0x04113b91BF0F9D87d712f3CA843Fb1374AEE8A89',
  /** Quoter V2 for CL swap quotes */
  quoterV2: '0x9055782E3797231b970C067d067Ee7dFA3396Cdd',
  /** CL swap router */
  swapRouter: '0xAda5d0E79681038A9547fe6a59f1413F3E720839',
} as const;

// ---------------------------------------------------------------------------
// Convenience combined export
// ---------------------------------------------------------------------------
export const ABOREAN_ADDRESSES = {
  ...ABOREAN_V2_ADDRESSES,
  ...ABOREAN_CL_ADDRESSES,
} as const;
