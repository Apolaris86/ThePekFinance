import "server-only";
import { cacheLife } from "next/cache";
import type { ChartRange, Exchange, Movers, Quote } from "@pek/shared";
import { fxRates, market, NotFoundError, yahooQuotes, yahooScreener } from "./providers";
import { CAC40, STI, US_LARGE_CAPS } from "./universe";

// Cached wrappers around the provider. Arguments are part of the cache key.
// Errors lose their class when crossing the cache boundary, so "not found"
// is returned as null and turned back into a 404 by the route.

async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof NotFoundError) return null;
    throw err;
  }
}

export async function getQuote(symbol: string) {
  "use cache";
  cacheLife({ stale: 15, revalidate: 15, expire: 60 });
  return orNull(market.getQuote(symbol));
}

export async function getHistory(symbol: string, range: ChartRange) {
  "use cache";
  if (range === "1D" || range === "5D") cacheLife({ stale: 60, revalidate: 60, expire: 300 });
  else cacheLife("hours");
  return orNull(market.getHistory(symbol, range));
}

export async function getNews(symbol?: string) {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  return market.getNews(symbol);
}

export async function searchSymbols(query: string) {
  "use cache";
  cacheLife("hours");
  return market.search(query);
}

export async function getProfile(symbol: string) {
  "use cache";
  cacheLife("days");
  return market.getProfile(symbol);
}

export async function getFxRates() {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  return fxRates();
}

export async function getQuotes(symbols: string[]) {
  "use cache";
  cacheLife({ stale: 15, revalidate: 15, expire: 60 });
  return yahooQuotes(symbols);
}

export async function getMovers(market: Exchange): Promise<Movers> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 60, expire: 600 });
  if (market === "US") {
    const [gainers, losers, active] = await Promise.all([
      yahooScreener("day_gainers"),
      yahooScreener("day_losers"),
      yahooScreener("most_actives"),
    ]);
    if (gainers.length && losers.length) return { gainers, losers, active };
  }
  const universe = { US: US_LARGE_CAPS, SGX: STI, EPA: CAC40 }[market];
  return rankMovers(await yahooQuotes(universe));
}

function rankMovers(quotes: Quote[]): Movers {
  const byChange = [...quotes].sort((a, b) => b.changePercent - a.changePercent);
  return {
    gainers: byChange.filter((q) => q.changePercent > 0).slice(0, 8),
    losers: byChange.filter((q) => q.changePercent < 0).reverse().slice(0, 8),
    active: [...quotes].sort((a, b) => (b.volume ?? 0) * b.price - (a.volume ?? 0) * a.price).slice(0, 8),
  };
}
