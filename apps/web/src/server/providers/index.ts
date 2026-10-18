import "server-only";
import { exchangeOf, type MarketDataProvider } from "@pek/shared";
import { finnhubEnabled, finnhubNews, finnhubQuote } from "./finnhub";
import { yahoo } from "./yahoo";

export { NotFoundError } from "./errors";

/**
 * Routes each call to the best free source:
 * - US prices and news from Finnhub (real-time) when FINNHUB_API_KEY is set
 * - everything else (SGX, Paris, charts, search, stats) from Yahoo
 */
export const market: MarketDataProvider = {
  async getQuote(symbol) {
    const base = await yahoo.getQuote(symbol);
    if (base.exchange !== "US" || symbol.startsWith("^") || !finnhubEnabled()) return base;
    try {
      const live = await finnhubQuote(symbol);
      return live ? { ...base, ...live, delayed: false } : base;
    } catch {
      return base;
    }
  },

  getHistory: (symbol, range) => yahoo.getHistory(symbol, range),

  async getNews(symbol) {
    const useFinnhub = finnhubEnabled() && (!symbol || exchangeOf(symbol) === "US");
    if (useFinnhub) {
      try {
        const items = await finnhubNews(symbol);
        if (items.length) return items;
      } catch {
        // fall through to Yahoo
      }
    }
    return yahoo.getNews(symbol);
  },

  search: (query) => yahoo.search(query),
  getProfile: (symbol) => yahoo.getProfile(symbol),
};
