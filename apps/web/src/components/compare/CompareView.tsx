"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { isValidSymbol, normalizeSymbol, type ChartRange, type Quote } from "@pek/shared";
import { SearchBox } from "@/components/SearchBox";
import { SERIES_COLORS } from "@/lib/colors";
import { formatCompact, formatNumber, formatPercent, formatPrice } from "@/lib/format";
import { api, useQuote } from "@/lib/queries";
import { CompareChart, type CompareSeries } from "./CompareChart";

const MAX = 5;
const RANGES: ChartRange[] = ["1M", "6M", "YTD", "1Y", "5Y"];

function parseSymbols(raw: string | null): string[] {
  return [...new Set((raw ?? "").split(",").map(normalizeSymbol).filter(isValidSymbol))].slice(0, MAX);
}

export function CompareView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const symbols = parseSymbols(params.get("s"));
  const [range, setRange] = useState<ChartRange>("1Y");

  function setSymbols(next: string[]) {
    router.replace(next.length ? `${pathname}?s=${next.map(encodeURIComponent).join(",")}` : pathname, { scroll: false });
  }

  const histories = useQueries({
    queries: symbols.map((s) => ({ queryKey: ["history", s, range], queryFn: () => api.history(s, range), staleTime: 60 * 60_000 })),
  });
  const loading = histories.some((h) => h.isPending);
  const symbolKey = symbols.join(",");
  const dataKey = histories.map((h) => h.dataUpdatedAt).join(",");
  const series: CompareSeries[] = useMemo(
    () => symbols.map((s, i) => ({ symbol: s, color: SERIES_COLORS[i], candles: histories[i]?.data ?? [] })).filter((s) => s.candles.length > 1),
    // histories is a new array every render; dataKey tracks the actual data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [symbolKey, dataKey],
  );

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {symbols.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-2 rounded-full border border-border py-1 pl-3 pr-1 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} />
            <Link href={`/quote/${encodeURIComponent(s)}`} className="font-mono font-semibold hover:underline">{s}</Link>
            <button aria-label={`Remove ${s}`} onClick={() => setSymbols(symbols.filter((x) => x !== s))} className="rounded-full px-2 text-muted hover:bg-surface hover:text-down">
              ✕
            </button>
          </span>
        ))}
        {symbols.length < MAX && (
          <div className="w-full sm:w-72">
            <SearchBox
              placeholder={symbols.length ? "Add a stock to compare" : "Pick stocks to compare"}
              onSelect={(item) => !symbols.includes(item.symbol) && setSymbols([...symbols, item.symbol])}
            />
          </div>
        )}
      </div>

      {symbols.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted">
          Add up to {MAX} stocks from any market. Their performance is shown as % change so different prices and currencies line up.
        </p>
      ) : (
        <>
          <section>
            <div role="tablist" aria-label="Range" className="flex border-b border-border">
              {RANGES.map((r) => (
                <button
                  key={r}
                  role="tab"
                  aria-selected={r === range}
                  onClick={() => setRange(r)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${r === range ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-4">
              {loading ? <div className="h-80 animate-pulse rounded-lg bg-surface sm:h-96" /> : <CompareChart series={series} />}
            </div>
          </section>
          <StatsTable symbols={symbols} series={series} />
        </>
      )}
    </div>
  );
}

function StatsTable({ symbols, series }: { symbols: string[]; series: CompareSeries[] }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Key stats</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium" />
              {symbols.map((s, i) => (
                <th key={s} className="px-4 py-2.5 text-right font-mono font-semibold" style={{ color: SERIES_COLORS[i] }}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <StatRows symbols={symbols} series={series} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatRows({ symbols, series }: { symbols: string[]; series: CompareSeries[] }) {
  const rows: { label: string; cell: (q: Quote | undefined, s: string) => React.ReactNode }[] = [
    { label: "Name", cell: (q) => <span className="block max-w-40 truncate text-right">{q?.name ?? "—"}</span> },
    { label: "Price", cell: (q) => (q ? formatPrice(q.price, q.currency) : "—") },
    { label: "Today", cell: (q) => (q ? <Tone v={q.changePercent}>{formatPercent(q.changePercent)}</Tone> : "—") },
    {
      label: "Range return",
      cell: (_q, s) => {
        const c = series.find((x) => x.symbol === s)?.candles;
        if (!c || c.length < 2) return "—";
        const pct = ((c[c.length - 1].close - c[0].close) / c[0].close) * 100;
        return <Tone v={pct}>{formatPercent(pct)}</Tone>;
      },
    },
    { label: "Market cap", cell: (q) => (q?.marketCap ? formatCompact(q.marketCap, q.currency) : "—") },
    { label: "P/E ratio", cell: (q) => (q?.peRatio ? formatNumber(q.peRatio) : "—") },
    { label: "Dividend yield", cell: (q) => (q?.dividendYield ? `${formatNumber(q.dividendYield * 100)}%` : "—") },
    {
      label: "52-week range",
      cell: (q) => (q?.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null ? `${formatNumber(q.fiftyTwoWeekLow)} – ${formatNumber(q.fiftyTwoWeekHigh)}` : "—"),
    },
  ];
  return (
    <>
      {rows.map((row) => (
        <tr key={row.label} className="border-b border-border last:border-0">
          <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted">{row.label}</th>
          {symbols.map((s) => (
            <StatCell key={s} symbol={s} render={(q) => row.cell(q, s)} />
          ))}
        </tr>
      ))}
    </>
  );
}

function StatCell({ symbol, render }: { symbol: string; render: (q: Quote | undefined) => React.ReactNode }) {
  const { data } = useQuote(symbol);
  return <td className="tabular px-4 py-2.5 text-right">{render(data)}</td>;
}

function Tone({ v, children }: { v: number; children: React.ReactNode }) {
  return <span className={`font-medium ${v >= 0 ? "text-up" : "text-down"}`}>{children}</span>;
}
