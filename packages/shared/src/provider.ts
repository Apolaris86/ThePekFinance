import type { Candle, ChartRange, CompanyProfile, NewsItem, Quote, SearchResult } from "./types";

/** Every market data source (Finnhub, Yahoo, a paid provider later) implements this. */
export interface MarketDataProvider {
  getQuote(symbol: string): Promise<Quote>;
  getHistory(symbol: string, range: ChartRange): Promise<Candle[]>;
  getNews(symbol?: string): Promise<NewsItem[]>;
  search(query: string): Promise<SearchResult[]>;
  getProfile(symbol: string): Promise<CompanyProfile | null>;
}

export const CHART_RANGES: ChartRange[] = ["1D", "5D", "1M", "6M", "YTD", "1Y", "2Y", "5Y", "MAX"];
