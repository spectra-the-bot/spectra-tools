import { Address } from 'ox';

const ETH_DECIMALS = 18n;
const WEI_PER_ETH = 10n ** ETH_DECIMALS;

/**
 * Converts wei (as bigint or string) to a human-readable ETH string.
 */
export function weiToEth(wei: bigint | string, decimals = 6): string {
  const weiValue = typeof wei === 'string' ? BigInt(wei) : wei;
  const whole = weiValue / WEI_PER_ETH;
  const frac = weiValue % WEI_PER_ETH;
  const fracStr = frac.toString().padStart(18, '0').slice(0, decimals).replace(/0+$/, '');
  return fracStr.length > 0 ? `${whole}.${fracStr}` : `${whole}`;
}

/**
 * Checksums an Ethereum address using EIP-55.
 * Accepts lowercase or mixed-case hex addresses.
 */
export function checksumAddress(address: string): string {
  return Address.checksum(address);
}

/**
 * Formats a Unix timestamp (seconds) to a human-readable string.
 */
export function formatTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Truncates a string in the middle, e.g. "0x1234...abcd".
 */
export function truncate(str: string, prefixLen = 6, suffixLen = 4): string {
  if (str.length <= prefixLen + suffixLen + 3) return str;
  return `${str.slice(0, prefixLen)}...${str.slice(-suffixLen)}`;
}
