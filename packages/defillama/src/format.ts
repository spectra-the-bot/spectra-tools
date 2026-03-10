/**
 * Format a percentage delta between two values.
 * Returns a string like "+12.3%" or "-5.1%".
 */
export function formatDelta(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? '0.0%' : current > 0 ? '+∞%' : '-∞%';
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Format a number as a USD string with compact suffixes.
 * E.g. 1_234_567 → "$1.23M", 456_000 → "$456K", 0.5 → "$0.50".
 */
export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  }
  return `${sign}$${abs.toFixed(2)}`;
}

/**
 * Format a number with comma separators.
 * E.g. 1234567.89 → "1,234,567.89".
 */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}
