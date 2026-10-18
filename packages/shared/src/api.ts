import type {
  Candle,
  ChartRange,
  CompanyProfile,
  Exchange,
  FxRates,
  Movers,
  NewsItem,
  PortfolioDigest,
  Quote,
  SearchResult,
  StockSummary,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Typed client for the ThePekFinance API. Web passes "" (same origin); mobile passes the deployed URL.
 * `getToken` supplies the signed-in user's access token for routes that need auth.
 */
export function createApiClient(baseUrl: string, getToken?: () => Promise<string | undefined>) {
  async function get<T>(path: string, authed = false): Promise<T> {
    const token = authed ? await getToken?.() : undefined;
    const res = await fetch(`${baseUrl}${path}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
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
    quotes: (symbols: string[]) => get<Quote[]>(`/api/quotes?symbols=${symbols.map(enc).join(",")}`),
    movers: (market: Exchange) => get<Movers>(`/api/movers?market=${market}`),
    stockSummary: (symbol: string) => get<StockSummary>(`/api/ai/summary/${enc(symbol)}`, true),
    portfolioDigest: () => get<PortfolioDigest>("/api/ai/digest", true),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
