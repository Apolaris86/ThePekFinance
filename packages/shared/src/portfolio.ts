import type { Candle, ChartRange, Currency, FxRates, Holding, Quote } from "./types";

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

export interface Position extends Holding {
  /** the individual purchase lots behind this position */
  lots: Holding[];
}

/** Merge lots of the same symbol into one position with a share-weighted average cost. */
export function groupLots(lots: Holding[]): Position[] {
  const bySymbol = new Map<string, Holding[]>();
  for (const lot of lots) bySymbol.set(lot.symbol, [...(bySymbol.get(lot.symbol) ?? []), lot]);
  return [...bySymbol.entries()].map(([symbol, group]) => {
    const shares = group.reduce((s, l) => s + l.shares, 0);
    const cost = group.reduce((s, l) => s + l.shares * l.buyPrice, 0);
    const earliest = group.reduce((d, l) => (l.buyDate < d ? l.buyDate : d), group[0].buyDate);
    return {
      id: symbol,
      symbol,
      shares,
      buyPrice: shares === 0 ? 0 : cost / shares,
      buyDate: earliest,
      portfolioId: group[0].portfolioId,
      currency: group[0].currency,
      lots: group,
    };
  });
}

export interface SeriesPoint {
  time: number;
  value: number;
}

/**
 * Daily portfolio value in the base currency. Each lot counts from its buy date,
 * valued at the last known close on or before each day. Uses today's FX rates.
 */
export function portfolioSeries(
  lots: Holding[],
  closes: Record<string, { time: number; close: number }[]>,
  base: Currency,
  fx: FxRates,
): SeriesPoint[] {
  const times = [...new Set(Object.values(closes).flatMap((c) => c.map((p) => p.time)))].sort((a, b) => a - b);
  const cursors: Record<string, number> = {};
  const last: Record<string, number | undefined> = {};
  const points: SeriesPoint[] = [];

  for (const t of times) {
    for (const [symbol, series] of Object.entries(closes)) {
      let i = cursors[symbol] ?? 0;
      while (i < series.length && series[i].time <= t) last[symbol] = series[i++].close;
      cursors[symbol] = i;
    }
    const day = new Date(t * 1000).toISOString().slice(0, 10);
    let value = 0;
    let held = false;
    for (const lot of lots) {
      const price = last[lot.symbol];
      if (lot.buyDate > day || price == null) continue;
      held = true;
      value += convert(lot.shares * price, lot.currency, base, fx);
    }
    if (held) points.push({ time: t, value });
  }
  return points;
}

// --- Gain over a period ----------------------------------------------------

export const GAIN_PERIODS = ["1D", "5D", "1M", "6M", "YTD", "1Y", "2Y"] as const;
export type GainPeriod = (typeof GAIN_PERIODS)[number];

/** Daily history needed to find a period's starting price; 1D uses the quote's previous close instead. */
export function historyRangeFor(period: GainPeriod): ChartRange | null {
  if (period === "1D") return null;
  return period === "5D" ? "1M" : period;
}

/** The price a symbol started the period at, valid as of the end of `date` (YYYY-MM-DD). */
export interface Baseline {
  price: number;
  date: string;
}

const isoDay = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);
const dayBefore = (day: string) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/**
 * 1D: the previous close. 5D: the close five sessions before the latest one.
 * Longer periods: the open of the first session in the range, standing in for the close just before it.
 * `candles` are the daily candles for historyRangeFor(period).
 */
export function periodBaseline(
  period: GainPeriod,
  quote: Pick<Quote, "previousClose" | "timestamp">,
  candles?: Candle[],
): Baseline | undefined {
  if (period === "1D") return { price: quote.previousClose, date: dayBefore(new Date(quote.timestamp).toISOString().slice(0, 10)) };
  if (!candles?.length) return undefined;
  if (period === "5D") {
    const c = candles[Math.max(0, candles.length - 6)];
    return { price: c.close, date: isoDay(c.time) };
  }
  return { price: candles[0].open, date: dayBefore(isoDay(candles[0].time)) };
}

export interface PeriodChange {
  change: number;
  /** value at the start of the period (or at purchase, for lots bought during it) */
  startValue: number;
  percent: number;
}

const withPercent = (change: number, startValue: number): PeriodChange => ({
  change,
  startValue,
  percent: startValue === 0 ? 0 : (change / startValue) * 100,
});

/** Change of one symbol's lots over the period. Lots bought during the period count from their buy price. */
export function lotsPeriodChange(lots: Holding[], price: number, baseline: Baseline): PeriodChange {
  let change = 0;
  let startValue = 0;
  for (const lot of lots) {
    const start = lot.buyDate > baseline.date ? lot.buyPrice : baseline.price;
    change += lot.shares * (price - start);
    startValue += lot.shares * start;
  }
  return withPercent(change, startValue);
}

/** Total of per-symbol period changes, converted to the base currency. */
export function sumPeriodChanges(items: { currency: Currency; change: PeriodChange }[], base: Currency, fx: FxRates): PeriodChange {
  let change = 0;
  let startValue = 0;
  for (const { currency, change: c } of items) {
    change += convert(c.change, currency, base, fx);
    startValue += convert(c.startValue, currency, base, fx);
  }
  return withPercent(change, startValue);
}
