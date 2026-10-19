import { describe, expect, it } from "vitest";
import { convert, summarize, valueHolding } from "./portfolio";
import { exchangeOf, currencyOf } from "./symbols";
import type { FxRates, Holding } from "./types";

// 1 USD = 1 USD, 1 SGD = 0.75 USD, 1 EUR = 1.10 USD
const fx: FxRates = { USD: 1, SGD: 0.75, EUR: 1.1, AUD: 0.65 };

const h = (p: Partial<Holding>): Holding => ({
  id: "1", portfolioId: "p", symbol: "AAPL", shares: 10, buyPrice: 100, buyDate: "2025-01-01", currency: "USD", ...p,
});

describe("convert", () => {
  it("is identity for same currency", () => expect(convert(50, "EUR", "EUR", fx)).toBe(50));
  it("converts SGD to USD", () => expect(convert(100, "SGD", "USD", fx)).toBeCloseTo(75));
  it("converts EUR to SGD", () => expect(convert(100, "EUR", "SGD", fx)).toBeCloseTo(146.667, 2));
});

describe("valueHolding", () => {
  it("computes gain and day change", () => {
    const v = valueHolding(h({}), 120, 115);
    expect(v.marketValue).toBe(1200);
    expect(v.gain).toBe(200);
    expect(v.gainPercent).toBeCloseTo(20);
    expect(v.dayChange).toBe(50);
  });
});

describe("summarize", () => {
  it("sums mixed-currency holdings in base currency", () => {
    const s = summarize(
      [valueHolding(h({}), 120, 120), valueHolding(h({ currency: "SGD", symbol: "D05.SI" }), 40, 40)],
      "USD",
      fx,
    );
    // 1200 USD + 400 SGD (=300 USD)
    expect(s.marketValue).toBeCloseTo(1500);
    // cost 1000 USD + 1000 SGD (=750 USD)
    expect(s.costBasis).toBeCloseTo(1750);
    expect(s.gain).toBeCloseTo(-250);
  });
});

describe("symbols", () => {
  it("maps suffixes to exchanges and currencies", () => {
    expect(exchangeOf("D05.SI")).toBe("SGX");
    expect(exchangeOf("mc.pa")).toBe("EPA");
    expect(currencyOf(exchangeOf("AAPL"))).toBe("USD");
  });
});

describe("symbol helpers", () => {
  it("maps indices and validates symbols", async () => {
    const { exchangeOf, normalizeSymbol, isValidSymbol } = await import("./symbols");
    expect(exchangeOf("^STI")).toBe("SGX");
    expect(normalizeSymbol(" mc.pa ")).toBe("MC.PA");
    expect(normalizeSymbol("%5EGSPC")).toBe("^GSPC");
    expect(isValidSymbol("BRK-B")).toBe(true);
    expect(isValidSymbol("D05.SI")).toBe(true);
    expect(isValidSymbol("<script>")).toBe(false);
  });
});

describe("groupLots", () => {
  it("averages cost across lots of one symbol", async () => {
    const { groupLots } = await import("./portfolio");
    const [p, q] = groupLots([
      h({ id: "a", shares: 10, buyPrice: 100, buyDate: "2025-03-01" }),
      h({ id: "b", shares: 30, buyPrice: 200, buyDate: "2025-01-01" }),
      h({ id: "c", symbol: "MC.PA", currency: "EUR" }),
    ]);
    expect(p.shares).toBe(40);
    expect(p.buyPrice).toBe(175);
    expect(p.buyDate).toBe("2025-01-01");
    expect(p.lots).toHaveLength(2);
    expect(q.symbol).toBe("MC.PA");
  });
});

describe("portfolioSeries", () => {
  it("counts lots from their buy date and carries prices forward", async () => {
    const { portfolioSeries } = await import("./portfolio");
    const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 1000;
    const series = portfolioSeries(
      [h({ shares: 2, buyDate: "2025-01-02" }), h({ symbol: "D05.SI", currency: "SGD", shares: 4, buyDate: "2025-01-03" })],
      {
        AAPL: [{ time: day("2025-01-01"), close: 90 }, { time: day("2025-01-02"), close: 100 }, { time: day("2025-01-03"), close: 110 }],
        "D05.SI": [{ time: day("2025-01-03"), close: 40 }],
      },
      "USD",
      fx,
    );
    expect(series).toEqual([
      { time: day("2025-01-02"), value: 200 },
      // 2 * 110 USD + 4 * 40 SGD (=120 USD)
      { time: day("2025-01-03"), value: 340 },
    ]);
  });
});

describe("period gains", () => {
  it("counts from the period's start price, or the buy price for lots bought during it", async () => {
    const { lotsPeriodChange, periodBaseline, sumPeriodChanges } = await import("./portfolio");
    const day = (d: string) => Date.parse(`${d}T14:30:00Z`) / 1000;
    const candle = (d: string, open: number, close: number) => ({ time: day(d), open, high: close, low: open, close });
    const candles = [candle("2026-09-01", 50, 55), candle("2026-09-02", 55, 60), candle("2026-10-01", 60, 70)];

    const base = periodBaseline("1M", { previousClose: 69, timestamp: day("2026-10-01") * 1000 }, candles)!;
    expect(base).toEqual({ price: 50, date: "2026-08-31" });

    // 10 shares held from before the period (start 50), 5 bought during it at 58; price now 70
    const c = lotsPeriodChange([h({ shares: 10 }), h({ shares: 5, buyPrice: 58, buyDate: "2026-09-02" })], 70, base);
    expect(c.change).toBe(10 * 20 + 5 * 12);
    expect(c.startValue).toBe(500 + 290);

    expect(periodBaseline("1D", { previousClose: 69, timestamp: day("2026-10-01") * 1000 })).toEqual({ price: 69, date: "2026-09-30" });
    expect(periodBaseline("5D", { previousClose: 69, timestamp: 0 }, candles)).toEqual({ price: 55, date: "2026-09-01" });

    const total = sumPeriodChanges(
      [{ currency: "USD", change: c }, { currency: "AUD", change: { change: 100, startValue: 1000, percent: 10 } }],
      "USD",
      fx,
    );
    expect(total.change).toBeCloseTo(260 + 65);
    expect(total.percent).toBeCloseTo((325 / (790 + 650)) * 100);
  });
});
