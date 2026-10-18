"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CHART_RANGES, timezoneOf, type Candle, type ChartRange, type Quote } from "@pek/shared";
import { formatCompact, formatNumber, formatPercent, formatPrice, formatSigned } from "@/lib/format";
import { isLiveEligible, useLiveStatus } from "@/lib/live";
import { api, useHistory, useNews, useProfile, useQuote } from "@/lib/queries";
import { AiCard } from "@/components/AiCard";
import { NewsList } from "@/components/NewsList";
import { PriceChart } from "./PriceChart";
import { StockActions } from "./StockActions";

const EXCHANGE_NAME = { US: "US", SGX: "SGX", EPA: "Euronext Paris" } as const;
const STATE_LABEL = { PRE: "Pre-market", REGULAR: "Market open", POST: "After hours", CLOSED: "Closed" } as const;

export function StockView({ symbol }: { symbol: string }) {
  const quote = useQuote(symbol);

  if (quote.isPending) return <PageSkeleton />;
  if (quote.isError) {
    const notFound = "status" in quote.error && quote.error.status === 404;
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-semibold">{notFound ? `We couldn't find "${symbol}"` : "Market data unavailable"}</h1>
        <p className="mt-2 text-muted">
          {notFound
            ? "Check the ticker. SGX tickers end in .SI (e.g. D05.SI), Paris tickers in .PA (e.g. MC.PA)."
            : "The data provider didn't respond. Try again in a moment."}
        </p>
        <Link href="/" className="mt-6 inline-block text-accent hover:underline">Back to home</Link>
      </div>
    );
  }

  const q = quote.data;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <PriceHeader quote={q} />
        <ChartSection quote={q} />
        <div className="mt-8">
          <AiCard
            title="AI summary"
            cta={`Summarize today for ${q.symbol}`}
            queryKey={["ai", "summary", q.symbol]}
            fetcher={() => api.stockSummary(q.symbol)}
          />
        </div>
        <NewsSection symbol={symbol} />
      </div>
      <aside className="space-y-8">
        <KeyStats quote={q} />
        <About symbol={symbol} />
      </aside>
    </div>
  );
}

function PriceHeader({ quote: q }: { quote: Quote }) {
  const prev = useRef(q.price);
  const [flash, setFlash] = useState<"" | "flash-up" | "flash-down">("");
  useEffect(() => {
    if (q.price !== prev.current) {
      setFlash(q.price > prev.current ? "flash-up" : "flash-down");
      prev.current = q.price;
      const t = setTimeout(() => setFlash(""), 1200);
      return () => clearTimeout(t);
    }
  }, [q.price]);

  const live = useLiveStatus() === "live" && isLiveEligible(q.symbol) && q.marketState === "REGULAR";
  const up = q.change >= 0;
  const asOf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezoneOf(q.exchange),
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(q.timestamp);

  return (
    <header>
      <nav className="text-sm text-muted">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <span className="mx-2">›</span>
        <span className="font-mono">{q.symbol}</span>
        <span className="mx-1">·</span>
        <span>{EXCHANGE_NAME[q.exchange]}</span>
      </nav>
      <h1 className="mt-2 text-2xl font-normal sm:text-3xl">{q.name ?? q.symbol}</h1>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`tabular rounded px-1 text-4xl font-medium ${flash}`}>{formatPrice(q.price, q.currency)}</span>
        <span className={`tabular rounded-md px-2 py-0.5 text-sm font-medium ${up ? "bg-up-bg text-up" : "bg-down-bg text-down"}`}>
          {up ? "▲" : "▼"} {formatPercent(q.changePercent)}
        </span>
        <span className={`tabular text-sm font-medium ${up ? "text-up" : "text-down"}`}>{formatSigned(q.change)} today</span>
      </div>
      <p className="mt-2 text-xs text-muted">
        {q.marketState ? `${STATE_LABEL[q.marketState]}: ` : ""}
        {asOf} · {q.currency}
        {live ? (
          <span className="ml-2 inline-flex items-center gap-1 rounded border border-up/40 px-1.5 py-0.5 text-up">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-up" /> Live
          </span>
        ) : (
          q.delayed && <span className="ml-2 rounded border border-border px-1.5 py-0.5">Delayed</span>
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <StockActions quote={q} />
        <Link
          href={`/compare?s=${encodeURIComponent(q.symbol)}`}
          className="rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:bg-surface"
        >
          Compare
        </Link>
      </div>
    </header>
  );
}

function ChartSection({ quote }: { quote: Quote }) {
  const [range, setRange] = useState<ChartRange>("1D");
  const history = useHistory(quote.symbol, range);
  const candles = history.data ?? [];
  const rangeChange = describeRangeChange(candles, range, quote);

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-4 border-b border-border">
        <div role="tablist" aria-label="Chart range" className="-mb-px flex overflow-x-auto">
          {CHART_RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={r === range}
              onClick={() => setRange(r)}
              className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition ${
                r === range ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        {rangeChange && range !== "1D" && (
          <span className={`tabular hidden shrink-0 text-sm font-medium sm:block ${rangeChange.up ? "text-up" : "text-down"}`}>
            {rangeChange.label}
          </span>
        )}
      </div>
      <div className={`relative mt-4 transition-opacity ${history.isFetching && history.isPlaceholderData ? "opacity-50" : ""}`}>
        {history.isPending ? (
          <div className="h-72 animate-pulse rounded-lg bg-surface sm:h-80" />
        ) : history.isError || candles.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-sm text-muted sm:h-80">No chart data for this range</div>
        ) : (
          <PriceChart
            candles={candles}
            range={range}
            currency={quote.currency}
            timezone={timezoneOf(quote.exchange)}
            baseline={range === "1D" ? quote.previousClose : undefined}
          />
        )}
      </div>
    </section>
  );
}

function describeRangeChange(candles: Candle[], range: ChartRange, q: Quote) {
  if (candles.length < 2) return null;
  const start = candles[0].close;
  const change = q.price - start;
  return { up: change >= 0, label: `${formatSigned(change)} (${formatPercent((change / start) * 100)}) ${range}` };
}

function KeyStats({ quote: q }: { quote: Quote }) {
  const p = (v?: number) => (v == null ? "—" : formatPrice(v, q.currency));
  const rows: [string, string][] = [
    ["Previous close", p(q.previousClose)],
    ["Open", p(q.open)],
    ["Day range", q.dayLow != null && q.dayHigh != null ? `${p(q.dayLow)} – ${p(q.dayHigh)}` : "—"],
    ["52-week range", q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null ? `${p(q.fiftyTwoWeekLow)} – ${p(q.fiftyTwoWeekHigh)}` : "—"],
    ["Market cap", q.marketCap ? formatCompact(q.marketCap, q.currency) : "—"],
    ["Volume", q.volume ? formatCompact(q.volume) : "—"],
    ["P/E ratio", q.peRatio ? formatNumber(q.peRatio) : "—"],
    ["Dividend yield", q.dividendYield ? `${formatNumber(q.dividendYield * 100)}%` : "—"],
  ];
  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">Key stats</h2>
      <dl className="divide-y divide-border rounded-xl border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <dt className="text-muted">{k}</dt>
            <dd className="tabular text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function About({ symbol }: { symbol: string }) {
  const { data: profile, isPending } = useProfile(symbol);
  const [expanded, setExpanded] = useState(false);
  if (isPending) return <div className="h-40 animate-pulse rounded-xl bg-surface" />;
  if (!profile?.description) return null;

  const facts: [string, string | undefined][] = [
    ["Sector", profile.sector],
    ["Industry", profile.industry],
    ["Employees", profile.employees?.toLocaleString("en-US")],
    ["Country", profile.country],
  ];
  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">About</h2>
      <p className={`text-sm leading-relaxed text-muted ${expanded ? "" : "line-clamp-5"}`}>{profile.description}</p>
      <button onClick={() => setExpanded((e) => !e)} className="mt-1 text-sm text-accent hover:underline">
        {expanded ? "Show less" : "Read more"}
      </button>
      <dl className="mt-3 space-y-1.5 text-sm">
        {facts
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right">{v}</dd>
            </div>
          ))}
        {profile.website && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Website</dt>
            <dd className="truncate">
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {profile.website.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function NewsSection({ symbol }: { symbol: string }) {
  const { data: news, isPending } = useNews(symbol);
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-medium">News</h2>
      <NewsList items={news} loading={isPending} />
    </section>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 w-40 rounded bg-surface" />
      <div className="h-8 w-72 rounded bg-surface" />
      <div className="h-12 w-56 rounded bg-surface" />
      <div className="h-80 rounded-lg bg-surface" />
    </div>
  );
}
