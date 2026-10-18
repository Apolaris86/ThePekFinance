import type { Currency, Exchange } from "./types";

/** Indices don't carry an exchange suffix, so map the ones we show explicitly. */
const INDEX_EXCHANGE: Record<string, Exchange> = {
  "^STI": "SGX",
  "^FCHI": "EPA",
};

/** Infer exchange from a Yahoo-style ticker suffix: D05.SI -> SGX, MC.PA -> EPA. */
export function exchangeOf(symbol: string): Exchange {
  const s = symbol.toUpperCase();
  if (INDEX_EXCHANGE[s]) return INDEX_EXCHANGE[s];
  if (s.endsWith(".SI")) return "SGX";
  if (s.endsWith(".PA")) return "EPA";
  return "US";
}

export function currencyOf(exchange: Exchange): Currency {
  switch (exchange) {
    case "SGX":
      return "SGD";
    case "EPA":
      return "EUR";
    default:
      return "USD";
  }
}

/** IANA timezone of each exchange, for chart axes and market-hours logic. */
export function timezoneOf(exchange: Exchange): string {
  switch (exchange) {
    case "SGX":
      return "Asia/Singapore";
    case "EPA":
      return "Europe/Paris";
    default:
      return "America/New_York";
  }
}

/** Normalise user input / URL segments: trims, upper-cases, decodes. */
export function normalizeSymbol(raw: string): string {
  return decodeURIComponent(raw).trim().toUpperCase();
}

/** Accepts tickers like AAPL, BRK-B, D05.SI, MC.PA, ^GSPC. */
export function isValidSymbol(symbol: string): boolean {
  return /^\^?[A-Z0-9][A-Z0-9.\-=]{0,14}$/.test(symbol);
}
