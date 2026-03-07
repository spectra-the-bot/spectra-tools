import { keccak_256 } from '@noble/hashes/sha3.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

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
  const addr = address.toLowerCase().replace(/^0x/, '');
  const hash = bytesToHex(keccak_256(utf8ToBytes(addr)));

  let result = '0x';
  for (let i = 0; i < addr.length; i++) {
    const char = addr[i];
    if (!char) continue;

    if (/[0-9]/.test(char)) {
      result += char;
      continue;
    }

    const hashNibble = Number.parseInt(hash[i] ?? '0', 16);
    result += hashNibble >= 8 ? char.toUpperCase() : char;
  }

  return result;
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
