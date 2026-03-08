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

export function relTime(unixSeconds: bigint | number): string {
  const ts = typeof unixSeconds === 'bigint' ? Number(unixSeconds) : unixSeconds;
  if (!Number.isFinite(ts) || ts <= 0) return 'n/a';
  const delta = ts - Math.floor(Date.now() / 1000);
  const abs = Math.abs(delta);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return delta >= 0 ? `in ${label}` : `${label} ago`;
}

export function asNum(value: bigint): number {
  return Number(value);
}

export const baseEnv = {
  ABSTRACT_RPC_URL: undefined,
};
