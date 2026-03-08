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

export function isoTime(unixSeconds: bigint | number): string {
  const ts = typeof unixSeconds === 'bigint' ? Number(unixSeconds) : unixSeconds;
  if (!Number.isFinite(ts) || ts <= 0) return 'n/a';

  try {
    return new Date(ts * 1000).toISOString().replace('.000Z', 'Z');
  } catch {
    return 'n/a';
  }
}

export function timeValue(unixSeconds: bigint | number, format: string): string | number {
  if (format === 'json' || format === 'jsonl') return isoTime(unixSeconds);
  return typeof unixSeconds === 'bigint' ? Number(unixSeconds) : unixSeconds;
}

export function asNum(value: bigint): number {
  return Number(value);
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
