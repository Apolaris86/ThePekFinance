import type { Currency } from "@pek/shared";

export function formatPrice(value: number, currency: Currency): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  }).format(value);
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

export function formatSigned(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : "−"}${formatNumber(Math.abs(value), digits)}`;
}

export function formatPercent(value: number): string {
  return `${formatSigned(value)}%`;
}

export function formatCompact(value: number, currency?: Currency): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
    ...(currency ? { style: "currency", currency } : {}),
  }).format(value);
}

export function timeAgo(ms: number): string {
  const mins = Math.round((Date.now() - ms) / 60_000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
