// Alert rules, shared by the check-alerts Edge Function (Deno) and the web app
// (re-exported from @pek/shared). Keep this file dependency-free.

export type AlertKind = "above" | "below" | "move";

export interface AlertRule {
  symbol: string;
  kind: AlertKind;
  threshold: number;
}

export interface AlertQuote {
  price: number;
  changePercent: number;
  currency?: string;
  /** Yahoo-style market state; "move" alerts only fire during the regular session */
  marketState?: string;
}

/** Whether the alert's condition holds for this quote. */
export function isTriggered(rule: AlertRule, q: AlertQuote): boolean {
  switch (rule.kind) {
    case "above":
      return q.price >= rule.threshold;
    case "below":
      return q.price <= rule.threshold;
    case "move":
      // Outside the session, changePercent is the previous day's move: don't fire on it.
      return q.marketState === "REGULAR" && Math.abs(q.changePercent) >= rule.threshold;
  }
}

/** Human-readable condition, e.g. "AAPL rises above 200 USD" or "MC.PA moves 5% in a day". */
export function describeAlert(rule: AlertRule, currency?: string): string {
  const money = (n: number) => `${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}${currency ? ` ${currency}` : ""}`;
  switch (rule.kind) {
    case "above":
      return `${rule.symbol} rises to ${money(rule.threshold)} or more`;
    case "below":
      return `${rule.symbol} falls to ${money(rule.threshold)} or less`;
    case "move":
      return `${rule.symbol} moves ${rule.threshold}% or more in a day`;
  }
}
