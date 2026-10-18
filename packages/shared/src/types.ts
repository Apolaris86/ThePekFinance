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
  marketCap?: number;
  peRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  /** fraction, e.g. 0.031 = 3.1% */
  dividendYield?: number;
  marketState?: MarketState;
  /** true when the price is delayed (e.g. SGX / Paris via Yahoo) */
  delayed: boolean;
  timestamp: number;
}

export type MarketState = "PRE" | "REGULAR" | "POST" | "CLOSED";

export interface CompanyProfile {
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
  website?: string;
  employees?: number;
  country?: string;
  description?: string;
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
  /** raw venue label, e.g. "NASDAQ", "SES", "Paris" */
  exchangeLabel?: string;
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

export interface Movers {
  gainers: Quote[];
  losers: Quote[];
  /** most traded by value (or volume, for US) */
  active: Quote[];
}
