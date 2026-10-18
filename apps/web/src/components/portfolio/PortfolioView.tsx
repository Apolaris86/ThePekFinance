"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  convert,
  groupLots,
  portfolioSeries,
  summarize,
  valueHolding,
  type ChartRange,
  type Currency,
  type FxRates,
  type Holding,
  type HoldingValuation,
  type Quote,
} from "@pek/shared";
import { HoldingForm } from "@/components/HoldingForm";
import { PriceChart } from "@/components/stock/PriceChart";
import { useBaseCurrency, useFx, useHoldingMutations, useHoldings, useSetBaseCurrency } from "@/lib/db-queries";
import { formatNumber, formatPercent, formatPrice, formatSignedPrice } from "@/lib/format";
import { api } from "@/lib/queries";
import { Donut } from "./Donut";

const CURRENCIES: Currency[] = ["USD", "SGD", "EUR"];
const EXCHANGE_NAME = { US: "United States", SGX: "Singapore", EPA: "Paris" } as const;

export function PortfolioView() {
  const holdings = useHoldings();
  const base = useBaseCurrency();
  const fx = useFx();
  const [adding, setAdding] = useState(false);

  const lots = holdings.data ?? [];
  const symbols = [...new Set(lots.map((l) => l.symbol))];
  const quotes = useQueries({
    queries: symbols.map((s) => ({ queryKey: ["quote", s], queryFn: () => api.quote(s), refetchInterval: 30_000 })),
    combine: (results) => Object.fromEntries(results.flatMap((r, i) => (r.data ? [[symbols[i], r.data]] : []))) as Record<string, Quote>,
  });

  if (holdings.isPending || base.isPending) return <div className="h-64 animate-pulse rounded-xl bg-surface" />;
  if (holdings.isError) return <p className="text-down">Couldn&apos;t load your portfolio.</p>;

  const header = (
    <div className="flex items-center justify-between gap-4">
      <h1 className="text-2xl font-normal">Portfolio</h1>
      <button onClick={() => setAdding(true)} className="rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-background hover:opacity-90">
        + Add holding
      </button>
      <HoldingForm open={adding} onClose={() => setAdding(false)} />
    </div>
  );

  if (lots.length === 0) {
    return (
      <div>
        {header}
        <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
          No holdings yet. Add your first one with the button above, or from any stock page.
        </p>
      </div>
    );
  }

  const baseCcy = base.data ?? "USD";
  const positions = groupLots(lots);
  const valuations = positions.flatMap((p) => (quotes[p.symbol] ? [valueHolding(p, quotes[p.symbol].price, quotes[p.symbol].previousClose)] : []));
  const ready = fx.data && valuations.length === positions.length;

  return (
    <div className="space-y-8">
      {header}
      {ready ? <Summary valuations={valuations} base={baseCcy} fx={fx.data!} /> : <div className="h-28 animate-pulse rounded-xl bg-surface" />}
      {fx.data && <ValueChart lots={lots} base={baseCcy} fx={fx.data} />}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <HoldingsTable valuations={valuations} quotes={quotes} />
        {ready && <Allocation valuations={valuations} quotes={quotes} base={baseCcy} fx={fx.data!} />}
      </div>
    </div>
  );
}

function Summary({ valuations, base, fx }: { valuations: HoldingValuation[]; base: Currency; fx: FxRates }) {
  const s = summarize(valuations, base, fx);
  const setBase = useSetBaseCurrency();
  const prevValue = s.marketValue - s.dayChange;
  const dayPct = prevValue === 0 ? 0 : (s.dayChange / prevValue) * 100;
  const tone = (v: number) => (v >= 0 ? "text-up" : "text-down");
  const signedMoney = (v: number) => formatSignedPrice(v, base);

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">Total value</p>
          <p className="tabular mt-1 text-4xl font-medium">{formatPrice(s.marketValue, base)}</p>
        </div>
        <label className="text-sm text-muted">
          Show in{" "}
          <select
            value={base}
            onChange={(e) => setBase.mutate(e.target.value as Currency)}
            className="ml-1 rounded-lg border border-border bg-surface px-2 py-1 text-foreground"
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted">Day change</dt>
          <dd className={`tabular mt-0.5 font-medium ${tone(s.dayChange)}`}>
            {signedMoney(s.dayChange)} ({formatPercent(dayPct)})
          </dd>
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
      <p className="mt-3 text-xs text-muted">Converted at today&apos;s exchange rates.</p>
    </section>
  );
}

const VALUE_RANGES: ChartRange[] = ["1M", "6M", "YTD", "1Y", "5Y"];

function ValueChart({ lots, base, fx }: { lots: Holding[]; base: Currency; fx: FxRates }) {
  const [range, setRange] = useState<ChartRange>("6M");
  const symbols = [...new Set(lots.map((l) => l.symbol))];
  const histories = useQueries({
    queries: symbols.map((s) => ({ queryKey: ["history", s, range], queryFn: () => api.history(s, range), staleTime: 60 * 60_000 })),
  });
  const loading = histories.some((h) => h.isPending);
  const closes = Object.fromEntries(symbols.map((s, i) => [s, histories[i].data ?? []]));
  const series = loading ? [] : portfolioSeries(lots, closes, base, fx);
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
        {loading ? (
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

function HoldingsTable({ valuations, quotes }: { valuations: HoldingValuation[]; quotes: Record<string, Quote> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<Holding | undefined>();
  const { remove } = useHoldingMutations();
  const tone = (v: number) => (v >= 0 ? "text-up" : "text-down");

  return (
    <section className="min-w-0">
      <h2 className="mb-3 text-lg font-medium">Holdings</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5 font-medium">Symbol</th>
              <th className="px-3 py-2.5 text-right font-medium">Shares</th>
              <th className="px-3 py-2.5 text-right font-medium">Avg cost</th>
              <th className="px-3 py-2.5 text-right font-medium">Price</th>
              <th className="px-3 py-2.5 text-right font-medium">Value</th>
              <th className="px-4 py-2.5 text-right font-medium">Total gain</th>
            </tr>
          </thead>
          <tbody>
            {valuations.map((v) => {
              const p = v.holding as Holding & { lots: Holding[] };
              const q = quotes[p.symbol];
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
                        <td colSpan={3} />
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

function Allocation({ valuations, quotes, base, fx }: { valuations: HoldingValuation[]; quotes: Record<string, Quote>; base: Currency; fx: FxRates }) {
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
