export const CHAIN_IDS: Record<string, number> = {
  abstract: 2741,
  ethereum: 1,
  mainnet: 1,
  base: 8453,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  avalanche: 43114,
  bsc: 56,
  linea: 59144,
  scroll: 534352,
  zksync: 324,
  mantle: 5000,
  blast: 81457,
  mode: 34443,
  sepolia: 11155111,
  goerli: 5,
};

export const DEFAULT_CHAIN = 'abstract';

export function resolveChainId(chain: string): number {
  const id = CHAIN_IDS[chain.toLowerCase()];
  if (id === undefined) {
    const known = Object.keys(CHAIN_IDS).join(', ');
    throw new Error(`Unknown chain "${chain}". Supported chains: ${known}`);
  }
  return id;
}
