import { checksumAddress, weiToEth } from '@spectratools/cli-shared';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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

export function asNum(value: bigint): number {
  return Number(value);
}

export function relTime(unixSeconds: bigint | number): string {
  const ts = typeof unixSeconds === 'bigint' ? Number(unixSeconds) : unixSeconds;
  if (!Number.isFinite(ts) || ts <= 0) return 'n/a';

  const delta = ts - Math.floor(Date.now() / 1000);
  const abs = Math.abs(delta);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  return delta >= 0 ? `in ${label}` : `${label} ago`;
}

export function clampPositive(seconds: number): number {
  return seconds > 0 ? seconds : 0;
}

export function formatBps(bps: number | bigint): string {
  const n = typeof bps === 'bigint' ? Number(bps) : bps;
  return `${(n / 10_000).toFixed(2)}%`;
}

export function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => jsonSafe(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        jsonSafe(entry),
      ]),
    );
  }
  return value;
}

export const baseEnv = {
  ABSTRACT_RPC_URL: undefined,
};
