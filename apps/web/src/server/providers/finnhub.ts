import "server-only";
import type { NewsItem } from "@pek/shared";

const BASE = "https://finnhub.io/api/v1";

export function finnhubEnabled(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const qs = new URLSearchParams({ ...params, token: process.env.FINNHUB_API_KEY ?? "" });
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok) throw new Error(`Finnhub ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

interface FinnhubQuote {
  c: number; d: number; dp: number; h: number; l: number; o: number; pc: number; t: number;
}

/** Real-time US price fields. Returns null when Finnhub has no data (c === 0). */
export async function finnhubQuote(symbol: string) {
  const q = await get<FinnhubQuote>("/quote", { symbol });
  if (!q.c) return null;
  return {
    price: q.c,
    change: q.d,
    changePercent: q.dp,
    dayHigh: q.h,
    dayLow: q.l,
    open: q.o,
    previousClose: q.pc,
    timestamp: q.t * 1000,
  };
}

interface FinnhubNews {
  id: number; headline: string; summary: string; source: string; url: string; image: string; datetime: number; related: string;
}

function toNews(n: FinnhubNews): NewsItem {
  return {
    id: String(n.id),
    headline: n.headline,
    summary: n.summary || undefined,
    source: n.source,
    url: n.url,
    image: n.image || undefined,
    publishedAt: n.datetime * 1000,
    symbols: n.related ? n.related.split(",") : undefined,
  };
}

export async function finnhubNews(symbol?: string): Promise<NewsItem[]> {
  if (!symbol) {
    const items = await get<FinnhubNews[]>("/news", { category: "general" });
    return items.slice(0, 20).map(toNews);
  }
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 86_400_000);
  const items = await get<FinnhubNews[]>("/company-news", {
    symbol,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });
  return items.slice(0, 20).map(toNews);
}
