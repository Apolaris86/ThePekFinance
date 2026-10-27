import { classify } from "./classification";
import { convert } from "./portfolio";
import type { CompanyProfile, Currency, FxRates, Quote } from "./types";

/** Ways to slice the allocation chart. */
export const ALLOCATION_VIEWS = [
  { id: "holding", label: "Holding" },
  { id: "investmentType", label: "Investment type" },
  { id: "theme", label: "Investment theme" },
  { id: "sector", label: "Sector" },
  { id: "type", label: "Asset type" },
  { id: "country", label: "Country" },
  { id: "marketCap", label: "Market cap" },
] as const;
export type AllocationView = (typeof ALLOCATION_VIEWS)[number]["id"];

export interface AllocationItem {
  symbol: string;
  name?: string;
  /** market value in the base currency */
  value: number;
  /** the holding's own trading currency */
  currency: Currency;
  quote?: Pick<Quote, "quoteType" | "marketCap" | "currency">;
  profile?: Pick<CompanyProfile, "sector" | "country"> | null;
}

export interface AllocationMember {
  symbol: string;
  name?: string;
  value: number;
  /** grouped by a guess (not in the classification map) */
  auto: boolean;
}

export interface AllocationSlice {
  label: string;
  value: number;
  /** holdings in this group, largest first */
  members: AllocationMember[];
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

function labelFor(item: AllocationItem, view: AllocationView, fx: FxRates): { label: string; auto: boolean } {
  const fund = isFund(item.quote?.quoteType);
  const plain = (label: string) => ({ label, auto: false });
  switch (view) {
    case "holding":
      return plain(item.symbol);
    case "investmentType":
    case "theme": {
      const c = classify(item.symbol, item.quote?.quoteType, item.profile?.sector);
      return { label: view === "theme" ? c.theme : c.type, auto: c.auto };
    }
    case "sector":
      // ETFs and funds hold many sectors, so they get their own slice.
      return plain(fund ? "ETFs & funds" : (item.profile?.sector ?? "Other"));
    case "type":
      return plain(assetTypeOf(item.quote?.quoteType));
    case "country":
      return plain(fund ? "ETFs & funds" : (item.profile?.country ?? "Other"));
    case "marketCap": {
      if (fund) return plain("ETFs & funds");
      const cap = item.quote?.marketCap;
      return plain(marketCapBucket(cap && item.quote?.currency ? convert(cap, item.quote.currency, "USD", fx) : undefined));
    }
  }
}

/** Groups holdings into slices for the chosen view, largest first, each listing its holdings. */
export function allocate(items: AllocationItem[], view: AllocationView, fx: FxRates): AllocationSlice[] {
  const groups = new Map<string, AllocationSlice>();
  for (const item of items) {
    const { label, auto } = labelFor(item, view, fx);
    const g = groups.get(label) ?? { label, value: 0, members: [] };
    g.value += item.value;
    g.members.push({ symbol: item.symbol, name: item.name, value: item.value, auto });
    groups.set(label, g);
  }
  const slices = [...groups.values()].sort((a, b) => b.value - a.value);
  for (const s of slices) s.members.sort((a, b) => b.value - a.value);
  return slices;
}
