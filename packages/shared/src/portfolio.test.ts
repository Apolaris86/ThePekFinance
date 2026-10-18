import { describe, expect, it } from "vitest";
import { convert, summarize, valueHolding } from "./portfolio";
import { exchangeOf, currencyOf } from "./symbols";
import type { FxRates, Holding } from "./types";

// 1 USD = 1 USD, 1 SGD = 0.75 USD, 1 EUR = 1.10 USD
const fx: FxRates = { USD: 1, SGD: 0.75, EUR: 1.1 };

const h = (p: Partial<Holding>): Holding => ({
  id: "1", symbol: "AAPL", shares: 10, buyPrice: 100, buyDate: "2025-01-01", currency: "USD", ...p,
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
