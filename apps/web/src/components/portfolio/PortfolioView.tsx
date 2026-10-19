"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  BASE_CURRENCIES,
  convert,
  exchangeOf,
  GAIN_PERIODS,
  groupLots,
  portfolioSeries,
  sumPeriodChanges,
  summarize,
  valueHolding,
  type BaseCurrency,
  type ChartRange,
  type FxRates,
  type GainPeriod,
  type Holding,
  type HoldingValuation,
  type PeriodChange,
  type Position,
  type Quote,
} from "@pek/shared";
import { AiCard } from "@/components/AiCard";
import { HoldingForm } from "@/components/HoldingForm";
import { PriceChart } from "@/components/stock/PriceChart";
import { useBaseCurrency, useFx, useHoldingMutations, useHoldings, usePortfolios, useSetBaseCurrency } from "@/lib/db-queries";
import { formatNumber, formatPercent, formatPrice, formatSignedPrice } from "@/lib/format";
import { useLiveSymbols } from "@/lib/live";
import { useHistories, usePeriodChanges } from "@/lib/period";
import { api, marketPoll } from "@/lib/queries";
import { Donut } from "./Donut";

const EXCHANGE_NAME = { US: "United States", SGX: "Singapore", EPA: "Paris" } as const;
const SELECTED_KEY = "pek.portfolio";

export function PortfolioView() {
  const portfolios = usePortfolios();
  const holdings = useHoldings();
  const base = useBaseCurrency();
  const fx = useFx();
  const [adding, setAdding] = useState(false);
  const [period, setPeriod] = useState<GainPeriod>("1D");
  // Remember which portfolio was open last (per browser). The first render is a
  // loading skeleton either way, so reading storage here can't cause a hydration mismatch.
  const [selected, setSelected] = useState<string | null>(() => {
    try {
      return typeof window === "undefined" ? null : localStorage.getItem(SELECTED_KEY);
    } catch {
      return null;
    }
  });
  function select(id: string) {
    setSelected(id);
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {}
  }

  const portfolio = portfolios.data?.find((p) => p.id === selected) ?? portfolios.data?.[0];
  const lots = (holdings.data ?? []).filter((l) => l.portfolioId === portfolio?.id);
  const symbols = [...new Set(lots.map((l) => l.symbol))];
  useLiveSymbols(symbols);
  const quotes = useQueries({
    queries: symbols.map((s) => ({ queryKey: ["quote", s], queryFn: () => api.quote(s), refetchInterval: marketPoll(exchangeOf(s)) })),
    combine: (results) => Object.fromEntries(results.flatMap((r, i) => (r.data ? [[symbols[i], r.data]] : []))) as Record<string, Quote>,
  });
  const positions = groupLots(lots);
  const periodChanges = usePeriodChanges(positions, quotes, period);

  if (holdings.isPending || base.isPending || portfolios.isPending) return <div className="h-64 animate-pulse rounded-xl bg-surface" />;
  if (holdings.isError || portfolios.isError) return <p className="text-down">Couldn&apos;t load your portfolio.</p>;

  const header = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-normal">Portfolio</h1>
        <button onClick={() => setAdding(true)} className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-background hover:opacity-90">
          + Add holding
        </button>
        <HoldingForm open={adding} onClose={() => setAdding(false)} portfolioId={portfolio?.id} />
      </div>
      <div role="tablist" aria-label="Portfolio" className="flex gap-2">
        {portfolios.data?.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={p.id === portfolio?.id}
            onClick={() => select(p.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium ${p.id === portfolio?.id ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"}`}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );

  if (lots.length === 0) {
    return (
      <div>
        {header}
        <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
          No holdings in {portfolio?.name ?? "this portfolio"} yet. Add one with the button above, or from any stock page.
        </p>
      </div>
    );
  }

  const baseCcy = base.data ?? "USD";
  const valuations = positions.flatMap((p) => (quotes[p.symbol] ? [valueHolding(p, quotes[p.symbol].price, quotes[p.symbol].previousClose)] : []));
  const ready = fx.data && valuations.length === positions.length;

  return (
    <div className="space-y-8">
      {header}
      {ready ? (
        <Summary
          valuations={valuations}
          base={baseCcy}
          fx={fx.data!}
          period={period}
          onPeriod={setPeriod}
          periodChanges={periodChanges.loading ? null : periodChanges.changes}
        />
      ) : (
        <div className="h-28 animate-pulse rounded-xl bg-surface" />
      )}
      {fx.data && <ValueChart lots={lots} base={baseCcy} fx={fx.data} />}
      <AiCard
        title="Today's digest"
        cta={`Write today's ${portfolio?.name ?? "portfolio"} digest`}
        // holdings are in the key so adding or editing a lot asks for a fresh digest
        queryKey={["ai", "digest", portfolio?.id, lots.map((l) => `${l.id}:${l.shares}:${l.buyPrice}`).join("|")]}
        fetcher={() => api.portfolioDigest(portfolio?.id)}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <HoldingsTable valuations={valuations} quotes={quotes} period={period} periodChanges={periodChanges.changes} />
        {ready && <Allocation valuations={valuations} quotes={quotes} base={baseCcy} fx={fx.data!} />}
      </div>
    </div>
  );
}

function Summary({
  valuations,
  base,
  fx,
  period,
  onPeriod,
  periodChanges,
}: {
  valuations: HoldingValuation[];
  base: BaseCurrency;
  fx: FxRates;
  period: GainPeriod;
  onPeriod: (p: GainPeriod) => void;
  /** null while the period's history is loading */
  periodChanges: Record<string, PeriodChange> | null;
}) {
  const s = summarize(valuations, base, fx);
  const setBase = useSetBaseCurrency();
  const other: BaseCurrency = base === "USD" ? "AUD" : "USD";
  const change =
    periodChanges &&
    sumPeriodChanges(
      valuations.flatMap((v) => {
        const c = periodChanges[v.holding.symbol];
        return c ? [{ currency: v.holding.currency, change: c }] : [];
      }),
      base,
      fx,
    );
  const tone = (v: number) => (v >= 0 ? "text-up" : "text-down");
  const signedMoney = (v: number) => formatSignedPrice(v, base);

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Total value</p>
          <p className="tabular mt-1 text-4xl font-medium">{formatPrice(s.marketValue, base)}</p>
          <p className="tabular mt-1 text-sm text-muted">≈ {formatPrice(convert(s.marketValue, base, other, fx), other)}</p>
        </div>
        <div role="radiogroup" aria-label="Show totals in" className="flex rounded-full border border-border p-0.5 text-sm">
          {BASE_CURRENCIES.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={c === base}
              onClick={() => setBase.mutate(c)}
              className={`rounded-full px-3 py-1 ${c === base ? "bg-accent/10 font-medium text-accent" : "text-muted"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div role="tablist" aria-label="Gain period" className="mt-4 flex flex-wrap gap-1">
        {GAIN_PERIODS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === period}
            onClick={() => onPeriod(p)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${p === period ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"}`}
          >
            {p}
          </button>
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">{period} change</dt>
          {change ? (
            <dd className={`tabular mt-0.5 font-medium ${tone(change.change)}`}>
              {signedMoney(change.change)} ({formatPercent(change.percent)})
            </dd>
          ) : (
            <dd className="mt-1 h-5 w-32 animate-pulse rounded bg-surface" />
          )}
        </div>
        <div>
          <dt className="text-xs text-muted">Total gain</dt>
          <dd className={`tabular mt-0.5 font-medium ${tone(s.gain)}`}>
            {signedMoney(s.gain)} ({formatPercent(s.gainPercent)})
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Cost basis</dt>
          <dd className="tabular mt-0.5 font-medium">{formatPrice(s.costBasis, base)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">Converted at today&apos;s exchange rates. Holdings bought during the period count from their buy price.</p>
    </section>
  );
}

const VALUE_RANGES: ChartRange[] = ["1M", "6M", "YTD", "1Y", "2Y", "5Y"];

function ValueChart({ lots, base, fx }: { lots: Holding[]; base: BaseCurrency; fx: FxRates }) {
  const [range, setRange] = useState<ChartRange>("6M");
  const histories = useHistories(
    lots.map((l) => l.symbol),
    range,
  );
  const series = histories.data ? portfolioSeries(lots, histories.data, base, fx) : [];
  const candles = series.map((p) => ({ time: p.time, open: p.value, high: p.value, low: p.value, close: p.value }));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <section>
      <div className="flex items-center justify-between border-b border-border">
        <h2 className="text-lg font-medium">Value over time</h2>
        <div role="tablist" aria-label="Value chart range" className="-mb-px flex">
          {VALUE_RANGES.map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={r === range}
              onClick={() => setRange(r)}
              className={`border-b-2 px-2.5 py-2 text-sm font-medium sm:px-3 ${r === range ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {histories.isPending ? (
          <div className="h-72 animate-pulse rounded-lg bg-surface sm:h-80" />
        ) : candles.length < 2 ? (
          <p className="flex h-40 items-center justify-center text-sm text-muted">Not enough history in this range yet.</p>
        ) : (
          <PriceChart candles={candles} range={range} currency={base} timezone={timezone} />
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Each lot counts from its buy date. Past values use today&apos;s exchange rates.</p>
    </section>
  );
}

function HoldingsTable({
  valuations,
  quotes,
  period,
  periodChanges,
}: {
  valuations: HoldingValuation[];
  quotes: Record<string, Quote>;
  period: GainPeriod;
  periodChanges: Record<string, PeriodChange>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Holding | undefined>();
  const { remove } = useHoldingMutations();
  const tone = (v: number) => (v >= 0 ? "text-up" : "text-down");

  return (
    <section className="min-w-0">
      <h2 className="mb-3 text-lg font-medium">Holdings</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-medium">Symbol</th>
              <th className="px-3 py-2.5 text-right font-medium">Shares</th>
              <th className="px-3 py-2.5 text-right font-medium">Avg cost</th>
              <th className="px-3 py-2.5 text-right font-medium">Price</th>
              <th className="px-3 py-2.5 text-right font-medium">Value</th>
              <th className="px-3 py-2.5 text-right font-medium">{period} change</th>
              <th className="px-4 py-2.5 text-right font-medium">Total gain</th>
            </tr>
          </thead>
          <tbody>
            {valuations.map((v) => {
              const p = v.holding as Position;
              const q = quotes[p.symbol];
              const pc = periodChanges[p.symbol];
              const ccy = p.currency;
              const open = expanded === p.symbol;
              return (
                <Fragment key={p.symbol}>
                  <tr onClick={() => setExpanded(open ? null : p.symbol)} className="cursor-pointer border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-4 py-3">
                      <Link href={`/quote/${encodeURIComponent(p.symbol)}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-semibold text-accent hover:underline">
                        {p.symbol}
                      </Link>
                      <p className="max-w-40 truncate text-xs text-muted">{q?.name}</p>
                    </td>
                    <td className="tabular px-3 py-3 text-right">{formatNumber(p.shares, p.shares % 1 ? 4 : 0)}</td>
                    <td className="tabular px-3 py-3 text-right">{formatPrice(p.buyPrice, ccy)}</td>
                    <td className="tabular px-3 py-3 text-right">
                      {formatPrice(v.price, ccy)}
                      <span className={`block text-xs ${tone(q?.changePercent ?? 0)}`}>{formatPercent(q?.changePercent ?? 0)}</span>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-medium">{formatPrice(v.marketValue, ccy)}</td>
                    <td className={`tabular px-3 py-3 text-right ${pc ? tone(pc.change) : "text-muted"}`}>
                      {pc ? formatSignedPrice(pc.change, ccy) : "…"}
                      {pc && <span className="block text-xs">{formatPercent(pc.percent)}</span>}
                    </td>
                    <td className={`tabular px-4 py-3 text-right font-medium ${tone(v.gain)}`}>
                      {formatSignedPrice(v.gain, ccy)}
                      <span className="block text-xs">{formatPercent(v.gainPercent)}</span>
                    </td>
                  </tr>
                  {open &&
                    p.lots.map((lot) => (
                      <tr key={lot.id} className="border-b border-border bg-surface/60 text-xs text-muted">
                        <td className="px-4 py-2 pl-6">
                          Bought {lot.buyDate}
                          <span className="mt-1 flex gap-3">
                            <button onClick={() => setEditing(lot)} className="text-accent hover:underline">Edit</button>
                            <button
                              onClick={() => confirm(`Delete this lot of ${lot.shares} ${lot.symbol}?`) && remove.mutate(lot.id)}
                              className="hover:text-down"
                            >
                              Delete
                            </button>
                          </span>
                        </td>
                        <td className="tabular px-3 py-2 text-right">{formatNumber(lot.shares, lot.shares % 1 ? 4 : 0)}</td>
                        <td className="tabular px-3 py-2 text-right">{formatPrice(lot.buyPrice, ccy)}</td>
                        <td colSpan={4} />
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Click a row to see, edit or delete individual purchases. Values are in each stock&apos;s own currency.</p>
      <HoldingForm open={!!editing} editing={editing} onClose={() => setEditing(undefined)} />
    </section>
  );
}

function Allocation({ valuations, quotes, base, fx }: { valuations: HoldingValuation[]; quotes: Record<string, Quote>; base: BaseCurrency; fx: FxRates }) {
  const [by, setBy] = useState<"stock" | "exchange">("stock");
  const inBase = (v: HoldingValuation) => convert(v.marketValue, v.holding.currency, base, fx);
  const slices =
    by === "stock"
      ? valuations.map((v) => ({ label: v.holding.symbol, value: inBase(v) }))
      : Object.entries(
          valuations.reduce<Record<string, number>>((acc, v) => {
            const ex = EXCHANGE_NAME[quotes[v.holding.symbol]?.exchange ?? "US"];
            acc[ex] = (acc[ex] ?? 0) + inBase(v);
            return acc;
          }, {}),
        ).map(([label, value]) => ({ label, value }));

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">Allocation</h2>
        <div className="flex rounded-full border border-border p-0.5 text-xs">
          {(["stock", "exchange"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setBy(k)}
              aria-pressed={by === k}
              className={`rounded-full px-3 py-1 ${by === k ? "bg-accent/10 font-medium text-accent" : "text-muted"}`}
            >
              By {k}
            </button>
          ))}
        </div>
      </div>
      <Donut slices={slices} format={(v) => formatPrice(v, base)} />
    </section>
  );
}
