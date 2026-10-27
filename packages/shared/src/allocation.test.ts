import { describe, expect, it } from "vitest";
import { allocate, marketCapBucket, type AllocationItem } from "./allocation";
import { classify } from "./classification";
import { seriesReturn } from "./portfolio";
import type { FxRates, Holding } from "./types";

const fx: FxRates = { USD: 1, SGD: 0.75, EUR: 1.1, AUD: 0.65 };

const items: AllocationItem[] = [
  { symbol: "AAPL", value: 600, currency: "USD", quote: { quoteType: "EQUITY", marketCap: 3e12, currency: "USD" }, profile: { sector: "Technology", country: "United States" } },
  { symbol: "D05.SI", value: 300, currency: "SGD", quote: { quoteType: "EQUITY", marketCap: 200e9, currency: "SGD" }, profile: { sector: "Financial Services", country: "Singapore" } },
  { symbol: "SPY", value: 100, currency: "USD", quote: { quoteType: "ETF", currency: "USD" }, profile: null },
];

describe("allocate", () => {
  it("groups by sector with ETFs in their own slice", () => {
    expect(allocate(items, "sector", fx).map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "Technology", value: 600 },
      { label: "Financial Services", value: 300 },
      { label: "ETFs & funds", value: 100 },
    ]);
  });

  it("groups by asset type", () => {
    expect(allocate(items, "type", fx).map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "Stocks", value: 900 },
      { label: "ETFs", value: 100 },
    ]);
  });

  it("buckets market cap in USD", () => {
    // 200B SGD = 150B USD -> large cap
    expect(allocate(items, "marketCap", fx).map((s) => s.label)).toEqual(["Mega cap ($200B+)", "Large cap ($10–200B)", "ETFs & funds"]);
    expect(marketCapBucket(undefined)).toBe("Unknown");
    expect(marketCapBucket(1e9)).toBe("Small cap (under $2B)");
  });
});

describe("investment type and theme", () => {
  it("uses the spreadsheet classification and lists members largest first", () => {
    const byType = allocate(items, "investmentType", fx);
    expect(byType.map((s) => s.label)).toEqual(["Large Predictable (Moderately Cyclical)", "ETF"]);
    expect(byType[0].members.map((m) => m.symbol)).toEqual(["AAPL", "D05.SI"]);
    expect(allocate(items, "theme", fx).map((s) => s.label)).toEqual(["Discretionary", "Banking", "Broad Market"]);
  });

  it("guesses unknown symbols from quote type and sector", () => {
    expect(classify("ZZZZ", "EQUITY", "Technology")).toEqual({ type: "Unclassified", theme: "Technology", auto: true });
    expect(classify("ZZZZ", "ETF")).toEqual({ type: "ETF", theme: "Unclassified", auto: true });
    expect(classify("CRWD")).toEqual({ type: "Speculative Growth", theme: "Cybersecurity", auto: false });
    const [slice] = allocate([{ symbol: "ZZZZ", value: 1, currency: "USD", quote: { quoteType: "EQUITY", currency: "USD" }, profile: { sector: "" } }], "theme", fx);
    expect(slice.label).toBe("Unclassified");
    expect(slice.members[0].auto).toBe(true);
  });
});

describe("seriesReturn", () => {
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 1000;
  const lot = (p: Partial<Holding>): Holding => ({ id: "1", portfolioId: "p", symbol: "AAPL", shares: 10, buyPrice: 100, buyDate: "2025-01-01", currency: "USD", ...p });

  it("measures growth and excludes money added mid-range", () => {
    const r = seriesReturn(
      [
        { time: day("2025-03-01"), value: 1000 },
        { time: day("2025-06-01"), value: 1700 },
      ],
      [lot({}), lot({ id: "2", shares: 5, buyPrice: 100, buyDate: "2025-04-01" })],
      "USD",
      fx,
    )!;
    // 1000 at start, 500 added in April, 1700 at end -> 200 growth on 1500 invested
    expect(r.added).toBe(500);
    expect(r.change).toBe(200);
    expect(r.percent).toBeCloseTo(13.333, 2);
  });

  it("needs two points", () => {
    expect(seriesReturn([{ time: 1, value: 1 }], [], "USD", fx)).toBeNull();
  });
});
