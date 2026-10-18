"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Exchange, MarketState, Quote } from "@pek/shared";
import { Sparkline } from "@/components/Sparkline";
import { useAuth } from "@/lib/auth";
import { useFx, useWatchlists } from "@/lib/db-queries";
import { formatNumber, formatPercent, formatPrice, timeAgo } from "@/lib/format";
import { useLiveStatus } from "@/lib/live";
import { api, marketPoll, useHistory, useNews, useQuote } from "@/lib/queries";

const INDICES = [
  { symbol: "^GSPC", name: "S&P 500", exchange: "US" },
  { symbol: "^IXIC", name: "Nasdaq", exchange: "US" },
  { symbol: "^DJI", name: "Dow Jones", exchange: "US" },
  { symbol: "^STI", name: "STI", exchange: "SGX" },
  { symbol: "^FCHI", name: "CAC 40", exchange: "EPA" },
] as const;

const MARKETS: { id: Exchange; label: string; index: string }[] = [
  { id: "US", label: "US", index: "^GSPC" },
  { id: "SGX", label: "Singapore", index: "^STI" },
  { id: "EPA", label: "Paris", index: "^FCHI" },
];

const STATE: Record<MarketState, { label: string; dot: string }> = {
  REGULAR: { label: "Open", dot: "bg-up" },
  PRE: { label: "Pre-market", dot: "bg-amber-500" },
  POST: { label: "After hours", dot: "bg-amber-500" },
  CLOSED: { label: "Closed", dot: "bg-muted" },
};

const tone = (v: number) => (v >= 0 ? "text-up" : "text-down");

export function MarketOverview() {
  const indices = useQuery({
    queryKey: ["quotes", "indices"],
    queryFn: () => api.quotes(INDICES.map((i) => i.symbol)),
    refetchInterval: marketPoll("US"),
  });
  const bySymbol = Object.fromEntries((indices.data ?? []).map((q) => [q.symbol, q]));

  return (
    <div className="space-y-8">
      <section aria-label="Indices" className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {INDICES.map((i) => (
          <IndexCard key={i.symbol} symbol={i.symbol} name={i.name} quote={bySymbol[i.symbol]} />
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          <Movers />
          <MarketNews />
        </div>
        <aside className="space-y-8">
          <MarketStatus quotes={bySymbol} />
          <FxRates />
          <YourWatchlist />
        </aside>
      </div>
    </div>
  );
}

function IndexCard({ symbol, name, quote }: { symbol: string; name: string; quote?: Quote }) {
  const { data: candles = [] } = useHistory(symbol, "1D");
  return (
    <Link
      href={`/quote/${encodeURIComponent(symbol)}`}
      className="w-44 shrink-0 snap-start rounded-xl border border-border p-3 transition hover:bg-surface lg:w-auto"
    >
      <p className="text-sm font-medium">{name}</p>
      {quote ? (
        <>
          <p className="tabular mt-1 text-lg">{formatNumber(quote.price)}</p>
          <p className={`tabular text-xs font-medium ${tone(quote.change)}`}>
            {formatPercent(quote.changePercent)} <span className="text-muted">·</span> {quote.change >= 0 ? "+" : "−"}
            {formatNumber(Math.abs(quote.change))}
          </p>
        </>
      ) : (
        <div className="mt-1 h-10 animate-pulse rounded bg-surface" />
      )}
      <Sparkline candles={candles} baseline={quote?.previousClose} className="mt-2 h-10 w-full" />
    </Link>
  );
}

function MarketStatus({ quotes }: { quotes: Record<string, Quote> }) {
  const live = useLiveStatus();
  const { user } = useAuth();
  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">Markets</h2>
      <ul className="divide-y divide-border rounded-xl border border-border text-sm">
        {MARKETS.map((m) => {
          const state = quotes[m.index]?.marketState;
          const s = state ? STATE[state] : null;
          return (
            <li key={m.id} className="flex items-center justify-between px-4 py-2.5">
              <span>{m.label}</span>
              <span className="flex items-center gap-2 text-muted">
                <span className={`h-2 w-2 rounded-full ${s?.dot ?? "bg-border"}`} />
                {s?.label ?? "—"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">
        {live === "live"
          ? "US prices streaming live. SGX and Paris refresh every 30s while open (delayed by the exchange)."
          : live === "unavailable"
            ? "Prices refresh every 30s while markets are open. Live US streaming needs a Finnhub key."
            : user
              ? "Prices refresh every 30s while markets are open. US stocks stream live on stock, watchlist and portfolio pages."
              : "Prices refresh every 30s while markets are open. Sign in for live US prices."}
      </p>
    </section>
  );
}

function FxRates() {
  const { data: fx } = useFx();
  const rows: [string, number | undefined][] = [
    ["USD / SGD", fx && 1 / fx.SGD],
    ["EUR / USD", fx?.EUR],
    ["EUR / SGD", fx && fx.EUR / fx.SGD],
  ];
  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">Currencies</h2>
      <dl className="divide-y divide-border rounded-xl border border-border text-sm">
        {rows.map(([pair, rate]) => (
          <div key={pair} className="flex items-center justify-between px-4 py-2.5">
            <dt>{pair}</dt>
            <dd className="tabular font-medium">{rate ? formatNumber(rate, 4) : "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

type MoverTab = "gainers" | "losers" | "active";
const MOVER_TABS: { id: MoverTab; label: string }[] = [
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
  { id: "active", label: "Most active" },
];

function Movers() {
  const [market, setMarket] = useState<Exchange>("US");
  const [tab, setTab] = useState<MoverTab>("gainers");
  const { data, isPending, isError } = useQuery({
    queryKey: ["movers", market],
    queryFn: () => api.movers(market),
    refetchInterval: marketPoll(market, 2),
  });
  const pill = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1 text-sm transition ${active ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"}`;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Market movers</h2>
        <div className="flex gap-2">
          {MARKETS.map((m) => (
            <button key={m.id} onClick={() => setMarket(m.id)} aria-pressed={market === m.id} className={pill(market === m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tablist" className="flex border-b border-border">
        {MOVER_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {isPending ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : isError || data[tab].length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No data right now.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data[tab].map((q) => (
            <li key={q.symbol}>
              <Link href={`/quote/${encodeURIComponent(q.symbol)}`} className="flex items-center gap-3 py-2.5 hover:bg-surface">
                <span className="w-20 shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-center font-mono text-xs font-semibold text-accent">
                  {q.symbol}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{q.name}</span>
                <span className="tabular shrink-0 text-sm">{formatPrice(q.price, q.currency)}</span>
                <span
                  className={`tabular w-20 shrink-0 rounded-md px-2 py-0.5 text-right text-sm font-medium ${q.change >= 0 ? "bg-up-bg text-up" : "bg-down-bg text-down"}`}
                >
                  {formatPercent(q.changePercent)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MarketNews() {
  const { data: news, isPending } = useNews();
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Market news</h2>
      {isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : !news?.length ? (
        <p className="text-sm text-muted">No news right now.</p>
      ) : (
        <ul className="divide-y divide-border">
          {news.slice(0, 8).map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="group flex gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {n.source} · {timeAgo(n.publishedAt)}
                  </p>
                  <p className="mt-1 font-medium leading-snug group-hover:text-accent">{n.headline}</p>
                </div>
                {n.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.image} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function YourWatchlist() {
  const { user } = useAuth();
  const { data: lists } = useWatchlists();
  if (!user) return null;
  const items = lists?.[0]?.items.slice(0, 8) ?? [];
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-medium">Your watchlist</h2>
        <Link href="/watchlist" className="text-sm text-accent hover:underline">See all</Link>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">Follow stocks to see them here.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {items.map((i) => (
            <WatchRow key={i.id} symbol={i.symbol} />
          ))}
        </ul>
      )}
    </section>
  );
}

function WatchRow({ symbol }: { symbol: string }) {
  const { data: q } = useQuote(symbol);
  return (
    <li>
      <Link href={`/quote/${encodeURIComponent(symbol)}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-surface">
        <span className="font-mono text-xs font-semibold">{symbol}</span>
        {q ? (
          <span className="tabular flex gap-3">
            <span>{formatPrice(q.price, q.currency)}</span>
            <span className={`w-16 text-right font-medium ${tone(q.change)}`}>{formatPercent(q.changePercent)}</span>
          </span>
        ) : (
          <span className="h-4 w-24 animate-pulse rounded bg-surface" />
        )}
      </Link>
    </li>
  );
}
