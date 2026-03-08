import { checksumAddress, weiToEth } from '@spectratools/cli-shared';

export function toChecksum(address: string): string {
  try {
    return checksumAddress(address);
  } catch {
    return address;
  }
}

export function eth(wei: bigint): string {
  return `${weiToEth(wei)} ETH`;
}

export function formatBps(bps: number | bigint): string {
  const n = typeof bps === 'bigint' ? Number(bps) : bps;
  return `${(n / 10_000).toFixed(2)}%`;
}

export const baseEnv = {
  ABSTRACT_RPC_URL: undefined,
};
