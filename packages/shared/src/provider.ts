import type { Candle, ChartRange, NewsItem, Quote, SearchResult } from "./types";

/** Every market data source (Finnhub, Yahoo, a paid provider later) implements this. */
export interface MarketDataProvider {
  getQuote(symbol: string): Promise<Quote>;
  getHistory(symbol: string, range: ChartRange): Promise<Candle[]>;
  getNews(symbol?: string): Promise<NewsItem[]>;
  search(query: string): Promise<SearchResult[]>;
}
