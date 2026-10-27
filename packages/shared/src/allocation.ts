import { convert } from "./portfolio";
import type { CompanyProfile, Currency, FxRates, Quote } from "./types";

/** Ways to slice the allocation chart. */
export const ALLOCATION_VIEWS = [
  { id: "holding", label: "Holding" },
  { id: "sector", label: "Sector" },
  { id: "type", label: "Asset type" },
  { id: "country", label: "Country" },
  { id: "currency", label: "Currency" },
  { id: "marketCap", label: "Market cap" },
] as const;
export type AllocationView = (typeof ALLOCATION_VIEWS)[number]["id"];

export interface AllocationItem {
  symbol: string;
  /** market value in the base currency */
  value: number;
  /** the holding's own trading currency */
  currency: Currency;
  quote?: Pick<Quote, "quoteType" | "marketCap" | "currency">;
  profile?: Pick<CompanyProfile, "sector" | "country"> | null;
}

export interface AllocationSlice {
  label: string;
  value: number;
}

const isFund = (quoteType?: string) => quoteType === "ETF" || quoteType === "MUTUALFUND";

export function assetTypeOf(quoteType?: string): string {
  switch (quoteType) {
    case "EQUITY":
      return "Stocks";
    case "ETF":
      return "ETFs";
    case "MUTUALFUND":
      return "Funds";
    default:
      return "Other";
  }
}

/** Standard size buckets on market cap in USD. */
export function marketCapBucket(marketCapUsd?: number): string {
  if (!marketCapUsd) return "Unknown";
  if (marketCapUsd >= 200e9) return "Mega cap ($200B+)";
  if (marketCapUsd >= 10e9) return "Large cap ($10–200B)";
  if (marketCapUsd >= 2e9) return "Mid cap ($2–10B)";
  return "Small cap (under $2B)";
}

function labelFor(item: AllocationItem, view: AllocationView, fx: FxRates): string {
  const fund = isFund(item.quote?.quoteType);
  switch (view) {
    case "holding":
      return item.symbol;
    case "sector":
      // ETFs and funds hold many sectors, so they get their own slice.
      return fund ? "ETFs & funds" : (item.profile?.sector ?? "Other");
    case "type":
      return assetTypeOf(item.quote?.quoteType);
    case "country":
      return fund ? "ETFs & funds" : (item.profile?.country ?? "Other");
    case "currency":
      return item.currency;
    case "marketCap": {
      if (fund) return "ETFs & funds";
      const cap = item.quote?.marketCap;
      return marketCapBucket(cap && item.quote?.currency ? convert(cap, item.quote.currency, "USD", fx) : undefined);
    }
  }
}

/** Groups holdings into slices for the chosen view, largest first. */
export function allocate(items: AllocationItem[], view: AllocationView, fx: FxRates): AllocationSlice[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const label = labelFor(item, view, fx);
    totals.set(label, (totals.get(label) ?? 0) + item.value);
  }
  return [...totals.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}
