import type { Currency, Exchange } from "./types";

/** Infer exchange from a Yahoo-style ticker suffix: D05.SI -> SGX, MC.PA -> EPA. */
export function exchangeOf(symbol: string): Exchange {
  const s = symbol.toUpperCase();
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
