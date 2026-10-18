export type Currency = "USD" | "SGD" | "EUR";

export type Exchange = "US" | "SGX" | "EPA";

export interface Quote {
  symbol: string;
  name?: string;
  exchange: Exchange;
  currency: Currency;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open?: number;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  /** true when the price is delayed (e.g. SGX / Paris via Yahoo) */
  delayed: boolean;
  timestamp: number;
}

export type ChartRange = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "5Y" | "MAX";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  summary?: string;
  source: string;
  url: string;
  image?: string;
  publishedAt: number;
  symbols?: string[];
}

export interface SearchResult {
  symbol: string;
  name: string;
  exchange: Exchange;
  type?: string;
}

export interface Holding {
  id: string;
  symbol: string;
  shares: number;
  buyPrice: number;
  buyDate: string;
  currency: Currency;
}

/** FX rates expressed as: 1 unit of key currency = rate units of base currency */
export type FxRates = Record<Currency, number>;
