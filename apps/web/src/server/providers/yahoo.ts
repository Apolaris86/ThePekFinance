import "server-only";
import YahooFinance from "yahoo-finance2";
import {
  currencyOf,
  exchangeOf,
  type Candle,
  type ChartRange,
  type CompanyProfile,
  type Currency,
  type Exchange,
  type FxRates,
  type MarketDataProvider,
  type MarketState,
  type NewsItem,
  type Quote,
  type SearchResult,
} from "@pek/shared";
import { NotFoundError } from "./errors";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

/** Yahoo venue codes we support, mapped to our exchanges. */
const VENUES: Record<string, Exchange> = {
  NMS: "US", NYQ: "US", NGM: "US", NCM: "US", ASE: "US", PCX: "US", BTS: "US",
  SNP: "US", DJI: "US", NIM: "US",
  SES: "SGX",
  PAR: "EPA",
};

const DAY = 86_400_000;

function marketState(raw?: string): MarketState | undefined {
  // Yahoo reports PREPRE / POSTPOST outside extended hours: treat those as closed.
  switch (raw) {
    case undefined:
      return undefined;
    case "PRE":
    case "POST":
    case "REGULAR":
      return raw;
    default:
      return "CLOSED";
  }
}

function asCurrency(raw: string | undefined, exchange: Exchange): Currency {
  return raw === "USD" || raw === "SGD" || raw === "EUR" || raw === "AUD" ? raw : currencyOf(exchange);
}

/** Keep only candles from the last `days` distinct trading dates. */
function lastSessions(candles: Candle[], days: number): Candle[] {
  const dates: string[] = [];
  for (let i = candles.length - 1; i >= 0; i--) {
    const d = new Date(candles[i].time * 1000).toISOString().slice(0, 10);
    if (!dates.includes(d)) {
      if (dates.length === days) return candles.slice(i + 1);
      dates.push(d);
    }
  }
  return candles;
}

function rangeQuery(range: ChartRange): { period1: Date; interval: "5m" | "15m" | "1d" | "1wk" | "1mo"; sessions?: number } {
  const now = Date.now();
  switch (range) {
    case "1D":
      return { period1: new Date(now - 5 * DAY), interval: "5m", sessions: 1 };
    case "5D":
      return { period1: new Date(now - 9 * DAY), interval: "15m", sessions: 5 };
    case "1M":
      return { period1: new Date(now - 31 * DAY), interval: "1d" };
    case "6M":
      return { period1: new Date(now - 183 * DAY), interval: "1d" };
    case "YTD":
      return { period1: new Date(new Date().getFullYear(), 0, 1), interval: "1d" };
    case "1Y":
      return { period1: new Date(now - 366 * DAY), interval: "1d" };
    case "2Y":
      return { period1: new Date(now - 2 * 366 * DAY), interval: "1d" };
    case "5Y":
      return { period1: new Date(now - 5 * 366 * DAY), interval: "1wk" };
    case "MAX":
      return { period1: new Date("1970-01-02"), interval: "1mo" };
  }
}

async function searchNews(query: string): Promise<NewsItem[]> {
  const res = await yf.search(query, { newsCount: 20, quotesCount: 0 });
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const n of res.news) {
    if (seen.has(n.title)) continue;
    seen.add(n.title);
    out.push({
      id: n.uuid,
      headline: n.title,
      source: n.publisher,
      url: n.link,
      image: n.thumbnail?.resolutions?.[0]?.url,
      publishedAt: new Date(n.providerPublishTime).getTime(),
      symbols: n.relatedTickers,
    });
  }
  return out;
}

/** The Yahoo quote fields we read; quote() and screener() results both fit. */
interface YQuote {
  symbol: string;
  longName?: string;
  shortName?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  trailingPE?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  trailingAnnualDividendYield?: number;
  marketState?: string;
  exchangeDataDelayedBy?: number;
  regularMarketTime?: Date | number | string;
}

function toQuote(q: YQuote): Quote {
  const price = q.regularMarketPrice ?? 0;
  const exchange = exchangeOf(q.symbol);
  return {
    symbol: q.symbol,
    name: q.longName ?? q.shortName,
    exchange,
    currency: asCurrency(q.currency, exchange),
    price,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    previousClose: q.regularMarketPreviousClose ?? price,
    open: q.regularMarketOpen,
    dayHigh: q.regularMarketDayHigh,
    dayLow: q.regularMarketDayLow,
    volume: q.regularMarketVolume,
    marketCap: q.marketCap,
    peRatio: q.trailingPE,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow,
    dividendYield: q.trailingAnnualDividendYield,
    marketState: marketState(q.marketState),
    delayed: (q.exchangeDataDelayedBy ?? 0) > 0,
    timestamp: q.regularMarketTime ? new Date(q.regularMarketTime).getTime() : Date.now(),
  };
}

/** One request for many symbols; unknown symbols are dropped. */
export async function yahooQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const res = (await yf.quote(symbols)) as YQuote[];
  return res.filter((q) => q.regularMarketPrice != null).map(toQuote);
}

export type MoverList = "day_gainers" | "day_losers" | "most_actives";

/** Yahoo US screeners. */
export async function yahooScreener(list: MoverList, count = 8): Promise<Quote[]> {
  const res = await yf.screener({ scrIds: list, count });
  return (res.quotes as YQuote[]).filter((q) => q.regularMarketPrice != null).map(toQuote);
}

export const yahoo: MarketDataProvider = {
  async getQuote(symbol) {
    let q;
    try {
      q = await yf.quote(symbol);
    } catch {
      throw new NotFoundError(symbol);
    }
    if (!q || q.regularMarketPrice == null) throw new NotFoundError(symbol);
    return toQuote(q as YQuote);
  },

  async getHistory(symbol, range) {
    const { period1, interval, sessions } = rangeQuery(range);
    let result;
    try {
      result = await yf.chart(symbol, { period1, interval });
    } catch {
      throw new NotFoundError(symbol);
    }
    const candles: Candle[] = result.quotes
      .filter((c) => c.close != null)
      .map((c) => ({
        time: Math.floor(new Date(c.date).getTime() / 1000),
        open: c.open ?? c.close!,
        high: c.high ?? c.close!,
        low: c.low ?? c.close!,
        close: c.close!,
        volume: c.volume ?? undefined,
      }));
    return sessions ? lastSessions(candles, sessions) : candles;
  },

  async getNews(symbol) {
    const items = await searchNews(symbol ?? "stock market");
    if (!symbol || items.length) return items;

    // Yahoo rarely indexes news by SGX/Paris tickers, so search by company
    // name and keep only stories that tag the ticker or mention the brand.
    const q = await yf.quote(symbol).catch(() => undefined);
    const name = q?.shortName ?? q?.longName;
    if (!name) return [];
    const brand = name.split(/[\s-]/)[0].toLowerCase();
    const byName = await searchNews(name);
    return byName.filter(
      (n) => n.symbols?.includes(symbol) || n.headline.toLowerCase().includes(brand),
    );
  },

  async search(query) {
    const res = await yf.search(query, { quotesCount: 12, newsCount: 0 });
    const out: SearchResult[] = [];
    for (const q of res.quotes) {
      if (!("symbol" in q) || !q.isYahooFinance) continue;
      const exchange = VENUES[q.exchange];
      if (!exchange) continue;
      out.push({
        symbol: q.symbol,
        name: ("longname" in q && q.longname) || ("shortname" in q && q.shortname) || q.symbol,
        exchange,
        exchangeLabel: "exchDisp" in q ? q.exchDisp : q.exchange,
        type: q.quoteType,
      });
    }
    return out;
  },

  async getProfile(symbol) {
    try {
      const s = await yf.quoteSummary(symbol, { modules: ["assetProfile", "price"] });
      const p = s.assetProfile;
      return {
        symbol,
        name: s.price?.longName ?? s.price?.shortName ?? symbol,
        sector: p?.sector,
        industry: p?.industry,
        website: p?.website,
        employees: p?.fullTimeEmployees,
        country: p?.country,
        description: p?.longBusinessSummary,
      } satisfies CompanyProfile;
    } catch {
      return null;
    }
  },
};

/** Value of 1 unit of each currency in USD, e.g. { USD: 1, SGD: 0.77, EUR: 1.16, AUD: 0.66 }. */
export async function fxRates(): Promise<FxRates> {
  const [sgd, eur, aud] = await Promise.all([yf.quote("SGDUSD=X"), yf.quote("EURUSD=X"), yf.quote("AUDUSD=X")]);
  if (!sgd?.regularMarketPrice || !eur?.regularMarketPrice || !aud?.regularMarketPrice) throw new Error("FX rates unavailable");
  return { USD: 1, SGD: sgd.regularMarketPrice, EUR: eur.regularMarketPrice, AUD: aud.regularMarketPrice };
}
