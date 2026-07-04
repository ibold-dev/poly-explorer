/**
 * Shared formatting utilities for currency, percentages, numbers, and time.
 * Used by both server and client components.
 */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const USD_COMPACT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const NUM_COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const PERCENT = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatUsd(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (n == null || isNaN(n)) return '$0.00';
  return USD.format(n);
}

export function formatUsdCompact(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (n == null || isNaN(n)) return '$0';
  return USD_COMPACT.format(n);
}

export function formatNumber(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (n == null || isNaN(n)) return '0';
  return NUM_COMPACT.format(n);
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0.0%';
  return PERCENT.format(value);
}

export function formatPrice(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (n == null || isNaN(n)) return '0¢';
  // Prices on Polymarket are 0-1, display as cents
  return `${(n * 100).toFixed(1)}¢`;
}

export function formatPnl(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '$0.00';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${USD.format(value)}`;
}

const RELATIVE_UNITS: [number, Intl.RelativeTimeFormatUnit][] = [
  [60, 'second'],
  [3600, 'minute'],
  [86400, 'hour'],
  [604800, 'day'],
  [2592000, 'week'],
  [31536000, 'month'],
  [Infinity, 'year'],
];

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function timeAgo(dateOrTimestamp: string | number | Date): string {
  const date = dateOrTimestamp instanceof Date
    ? dateOrTimestamp
    : typeof dateOrTimestamp === 'number'
      ? new Date(dateOrTimestamp * 1000)
      : new Date(dateOrTimestamp);

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(seconds);

  for (const [threshold, unit] of RELATIVE_UNITS) {
    if (absSeconds < threshold) {
      const divisor = RELATIVE_UNITS[RELATIVE_UNITS.indexOf([threshold, unit]) - 1]?.[0] ?? 1;
      const value = Math.round(seconds / divisor);
      return RTF.format(value, unit);
    }
  }
  return RTF.format(Math.round(seconds / 31536000), 'year');
}

export function formatDate(dateOrTimestamp: string | number | Date): string {
  const date = dateOrTimestamp instanceof Date
    ? dateOrTimestamp
    : typeof dateOrTimestamp === 'number'
      ? new Date(dateOrTimestamp * 1000)
      : new Date(dateOrTimestamp);

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(dateOrTimestamp: string | number | Date): string {
  const date = dateOrTimestamp instanceof Date
    ? dateOrTimestamp
    : typeof dateOrTimestamp === 'number'
      ? new Date(dateOrTimestamp * 1000)
      : new Date(dateOrTimestamp);

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function truncateAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
