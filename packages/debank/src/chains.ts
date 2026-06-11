/**
 * DeBank uses short string chain identifiers (e.g. "eth", "bsc", "xdai") rather
 * than numeric chain IDs. This module documents the common ones and normalizes a
 * few friendly aliases to DeBank's canonical id, while still allowing any raw
 * DeBank chain id to pass through untouched (DeBank supports 100+ chains).
 *
 * Reference: https://docs.cloud.debank.com/en/readme/api-pro-reference/chain
 */

/** Friendly alias → DeBank canonical chain id. */
const CHAIN_ALIASES: Record<string, string> = {
  ethereum: 'eth',
  mainnet: 'eth',
  binance: 'bsc',
  'binance-smart-chain': 'bsc',
  bnb: 'bsc',
  gnosis: 'xdai',
  polygon: 'matic',
  avalanche: 'avax',
  arbitrum: 'arb',
  optimism: 'op',
};

/** A non-exhaustive list of common DeBank chain ids, shown in help text. */
export const COMMON_CHAINS = [
  'eth',
  'bsc',
  'xdai',
  'matic',
  'ftm',
  'avax',
  'op',
  'arb',
  'base',
  'linea',
  'scrl',
  'era', // zkSync Era
  'mnt', // Mantle
  'blast',
] as const;

/**
 * Resolve a user-supplied chain string to DeBank's canonical chain id.
 * Friendly aliases are mapped; anything else is lowercased and passed through so
 * that DeBank-native ids the alias table doesn't know about still work.
 */
export function resolveChainId(chain: string): string {
  const key = chain.trim().toLowerCase();
  return CHAIN_ALIASES[key] ?? key;
}
