import { describe, expect, it } from "vitest";
import { describeAlert, isTriggered, type AlertQuote } from "./alerts";

const q = (p: Partial<AlertQuote>): AlertQuote => ({ price: 100, changePercent: 0, marketState: "REGULAR", ...p });

describe("isTriggered", () => {
  it("fires above/below at or past the threshold", () => {
    expect(isTriggered({ symbol: "AAPL", kind: "above", threshold: 100 }, q({ price: 100 }))).toBe(true);
    expect(isTriggered({ symbol: "AAPL", kind: "above", threshold: 100.01 }, q({ price: 100 }))).toBe(false);
    expect(isTriggered({ symbol: "AAPL", kind: "below", threshold: 100 }, q({ price: 99.5 }))).toBe(true);
    expect(isTriggered({ symbol: "AAPL", kind: "below", threshold: 99 }, q({ price: 99.5 }))).toBe(false);
  });

  it("fires move alerts in either direction, only during the regular session", () => {
    const rule = { symbol: "MC.PA", kind: "move" as const, threshold: 3 };
    expect(isTriggered(rule, q({ changePercent: -3.2 }))).toBe(true);
    expect(isTriggered(rule, q({ changePercent: 2.9 }))).toBe(false);
    expect(isTriggered(rule, q({ changePercent: 5, marketState: "CLOSED" }))).toBe(false);
  });
});

describe("describeAlert", () => {
  it("reads naturally", () => {
    expect(describeAlert({ symbol: "AAPL", kind: "above", threshold: 200 }, "USD")).toBe("AAPL rises to 200 USD or more");
    expect(describeAlert({ symbol: "MC.PA", kind: "move", threshold: 5 })).toBe("MC.PA moves 5% or more in a day");
  });
});
