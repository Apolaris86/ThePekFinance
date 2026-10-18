import type { Currency, FxRates, Holding } from "./types";

export function convert(amount: number, from: Currency, to: Currency, fx: FxRates): number {
  if (from === to) return amount;
  // fx is relative to a common base: value_in_base = amount * fx[from]
  return (amount * fx[from]) / fx[to];
}

export interface HoldingValuation {
  holding: Holding;
  price: number;
  marketValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  dayChange: number;
}

export function valueHolding(holding: Holding, price: number, previousClose: number): HoldingValuation {
  const marketValue = holding.shares * price;
  const costBasis = holding.shares * holding.buyPrice;
  const gain = marketValue - costBasis;
  return {
    holding,
    price,
    marketValue,
    costBasis,
    gain,
    gainPercent: costBasis === 0 ? 0 : (gain / costBasis) * 100,
    dayChange: holding.shares * (price - previousClose),
  };
}

export interface PortfolioSummary {
  currency: Currency;
  marketValue: number;
  costBasis: number;
  gain: number;
  gainPercent: number;
  dayChange: number;
}

/** Totals across holdings in different currencies, converted to the base currency. */
export function summarize(valuations: HoldingValuation[], base: Currency, fx: FxRates): PortfolioSummary {
  let marketValue = 0;
  let costBasis = 0;
  let dayChange = 0;
  for (const v of valuations) {
    const c = v.holding.currency;
    marketValue += convert(v.marketValue, c, base, fx);
    costBasis += convert(v.costBasis, c, base, fx);
    dayChange += convert(v.dayChange, c, base, fx);
  }
  const gain = marketValue - costBasis;
  return {
    currency: base,
    marketValue,
    costBasis,
    gain,
    gainPercent: costBasis === 0 ? 0 : (gain / costBasis) * 100,
    dayChange,
  };
}
