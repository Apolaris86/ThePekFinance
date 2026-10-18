import type { Candle, ChartRange, CompanyProfile, FxRates, NewsItem, Quote, SearchResult } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Typed client for the ThePekFinance API. Web passes "" (same origin); mobile passes the deployed URL. */
export function createApiClient(baseUrl: string) {
  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`);
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, body?.error ?? res.statusText);
    return body as T;
  }
  const enc = encodeURIComponent;
  return {
    quote: (symbol: string) => get<Quote>(`/api/quote/${enc(symbol)}`),
    history: (symbol: string, range: ChartRange) => get<Candle[]>(`/api/history/${enc(symbol)}?range=${range}`),
    profile: (symbol: string) => get<CompanyProfile | null>(`/api/profile/${enc(symbol)}`),
    news: (symbol?: string) => get<NewsItem[]>(`/api/news${symbol ? `?symbol=${enc(symbol)}` : ""}`),
    search: (q: string) => get<SearchResult[]>(`/api/search?q=${enc(q)}`),
    fx: () => get<FxRates>("/api/fx"),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
