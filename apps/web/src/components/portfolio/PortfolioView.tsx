"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  allocate,
  ALLOCATION_VIEWS,
  BASE_CURRENCIES,
  convert,
  exchangeOf,
  GAIN_PERIODS,
  groupLots,
  portfolioSeries,
  seriesReturn,
  sumPeriodChanges,
  summarize,
  valueHolding,
  type AllocationView,
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

const SELECTED_KEY = "pek.portfolio";
const SORT_KEY = "pek.holdingsSort";
const ALLOCATION_KEY = "pek.allocationView";

/** Per-browser view preferences; storage can be missing (private mode), so every access is guarded. */
function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = typeof window === "undefined" ? null : localStorage.getItem(key);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

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
      {fx.data && <ValueChart lots={lots} base={baseCcy} fx={fx.data} quotes={quotes} />}
      <AiCard
        title="Today's digest"
        cta={`Write today's ${portfolio?.name ?? "portfolio"} digest`}
        // holdings are in the key so adding or editing a lot asks for a fresh digest
        queryKey={["ai", "digest", portfolio?.id, lots.map((l) => `${l.id}:${l.shares}:${l.buyPrice}`).join("|")]}
        fetcher={() => api.portfolioDigest(portfolio?.id)}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <HoldingsTable valuations={valuations} quotes={quotes} period={period} periodChanges={periodChanges.changes} base={baseCcy} fx={fx.data} />
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

function ValueChart({ lots, base, fx, quotes }: { lots: Holding[]; base: BaseCurrency; fx: FxRates; quotes: Record<string, Quote> }) {
  const [range, setRange] = useState<ChartRange>("6M");
  // "" = whole portfolio; otherwise one holding's symbol
  const [only, setOnly] = useState("");
  const symbols = [...new Set(lots.map((l) => l.symbol))].sort();
  const shown = only && symbols.includes(only) ? lots.filter((l) => l.symbol === only) : lots;
  // Fetch history for every holding so switching the picker is instant.
  const histories = useHistories(symbols, range);
  const series = histories.data ? portfolioSeries(shown, histories.data, base, fx) : [];
  const ret = seriesReturn(series, shown, base, fx);
  const candles = series.map((p) => ({ time: p.time, open: p.value, high: p.value, low: p.value, close: p.value }));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-border">
        <div className="pb-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-medium">Value over time</h2>
            <label className="sr-only" htmlFor="value-chart-holding">Show</label>
            <select
              id="value-chart-holding"
              value={only}
              onChange={(e) => setOnly(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-sm"
            >
              <option value="">All holdings</option>
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {quotes[s]?.name ? ` · ${quotes[s].name}` : ""}
                </option>
              ))}
            </select>
          </div>
          {ret ? (
            <p className={`tabular mt-1 text-sm font-medium ${ret.change >= 0 ? "text-up" : "text-down"}`}>
              {formatSignedPrice(ret.change, base)} ({formatPercent(ret.percent)}) over {range}
              {ret.added > 0 && <span className="font-normal text-muted"> · not counting {formatPrice(ret.added, base)} added</span>}
            </p>
          ) : (
            <p className="mt-1 h-5" />
          )}
        </div>
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
      <p className="mt-2 text-xs text-muted">
        Growth is the change in value minus money added during the period, as a share of what was invested. Each lot counts from its buy date; past values use
        today&apos;s exchange rates.
      </p>
    </section>
  );
}

type SortKey = "symbol" | "shares" | "avgCost" | "price" | "value" | "period" | "gain";
type SortDir = "asc" | "desc";
const SORT_KEYS: SortKey[] = ["symbol", "shares", "avgCost", "price", "value", "period", "gain"];

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M11.3 2.7a1.5 1.5 0 0 1 2.1 2.1L5.8 12.4 3 13l.6-2.8 7.7-7.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function HoldingsTable({
  valuations,
  quotes,
  period,
  periodChanges,
  base,
  fx,
}: {
  valuations: HoldingValuation[];
  quotes: Record<string, Quote>;
  period: GainPeriod;
  periodChanges: Record<string, PeriodChange>;
  base: BaseCurrency;
  /** used to compare holdings in different currencies; native amounts until rates load */
  fx?: FxRates;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingLot, setEditingLot] = useState<Holding | undefined>();
  const [editingPosition, setEditingPosition] = useState<Position | undefined>();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(() => {
    const [key, dir] = readPref(SORT_KEY, SORT_KEYS.flatMap((k) => [`${k}:asc`, `${k}:desc`]), "value:desc").split(":");
    return { key: key as SortKey, dir: dir as SortDir };
  });
  const { remove } = useHoldingMutations();
  const tone = (v: number) => (v >= 0 ? "text-up" : "text-down");

  // Amounts are compared in the base currency so USD, SGD, EUR and AUD holdings rank fairly.
  const inBase = (amount: number, v: HoldingValuation) => (fx ? convert(amount, v.holding.currency, base, fx) : amount);
  const sortValue = (v: HoldingValuation): number | string => {
    switch (sort.key) {
      case "symbol":
        return v.holding.symbol;
      case "shares":
        return v.holding.shares;
      case "avgCost":
        return inBase(v.holding.buyPrice, v);
      case "price":
        return inBase(v.price, v);
      case "value":
        return inBase(v.marketValue, v);
      case "period": {
        const pc = periodChanges[v.holding.symbol];
        return pc ? inBase(pc.change, v) : Number.NEGATIVE_INFINITY;
      }
      case "gain":
        return inBase(v.gain, v);
    }
  };
  const sorted = [...valuations].sort((a, b) => {
    const x = sortValue(a);
    const y = sortValue(b);
    const cmp = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
    return sort.dir === "asc" ? cmp : -cmp;
  });

  function sortBy(key: SortKey) {
    // Text sorts A→Z first; numbers biggest first.
    const dir: SortDir = sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : key === "symbol" ? "asc" : "desc";
    setSort({ key, dir });
    writePref(SORT_KEY, `${key}:${dir}`);
  }

  const header = (key: SortKey, label: string, align: "left" | "right" = "right", pad = "px-3") => {
    const active = sort.key === key;
    return (
      <th aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`${pad} py-1.5 font-medium text-${align}`}>
        <button
          onClick={() => sortBy(key)}
          className={`inline-flex items-center gap-1 rounded px-1 py-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
        >
          {label}
          <span aria-hidden className={`text-[10px] ${active ? "" : "opacity-30"}`}>
            {active ? (sort.dir === "asc" ? "▲" : "▼") : "▼"}
          </span>
        </button>
      </th>
    );
  };

  return (
    <section className="min-w-0">
      <h2 className="mb-3 text-lg font-medium">Holdings</h2>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              {header("symbol", "Symbol", "left", "px-3")}
              {header("shares", "Shares")}
              {header("avgCost", "Avg cost")}
              {header("price", "Price")}
              {header("value", "Value")}
              {header("period", `${period} change`)}
              {header("gain", "Total gain", "right", "pl-3 pr-4")}
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => {
              const p = v.holding as Position;
              const q = quotes[p.symbol];
              const pc = periodChanges[p.symbol];
              const ccy = p.currency;
              const open = expanded === p.symbol;
              return (
                <Fragment key={p.symbol}>
                  <tr onClick={() => setExpanded(open ? null : p.symbol)} className="cursor-pointer border-b border-border last:border-0 hover:bg-surface">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/quote/${encodeURIComponent(p.symbol)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs font-semibold text-accent hover:underline"
                        >
                          {p.symbol}
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPosition(p);
                          }}
                          aria-label={`Edit shares and average cost for ${p.symbol}`}
                          title="Edit shares and average cost"
                          className="rounded p-1 text-muted hover:bg-background hover:text-accent"
                        >
                          <PencilIcon />
                        </button>
                      </div>
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
                            <button onClick={() => setEditingLot(lot)} className="text-accent hover:underline">Edit</button>
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
      <p className="mt-2 text-xs text-muted">
        Click a column to sort. The pencil edits shares and average cost; click a row to see individual purchases. Values are in each stock&apos;s own currency.
      </p>
      <HoldingForm open={!!editingLot} editing={editingLot} onClose={() => setEditingLot(undefined)} />
      <PositionEditor position={editingPosition} onClose={() => setEditingPosition(undefined)} />
    </section>
  );
}

/**
 * Edit a holding's total shares and average cost. A holding made of several
 * purchases is combined into one purchase (dated at the earliest buy) so the
 * totals stay exactly what was entered.
 */
function PositionEditor({ position, onClose }: { position?: Position; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { update, remove } = useHoldingMutations();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (position && !d.open) {
      setError(null);
      d.showModal();
    } else if (!position && d.open) d.close();
  }, [position]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!position) return;
    const f = new FormData(e.currentTarget);
    const shares = Number(f.get("shares"));
    const buyPrice = Number(f.get("buyPrice"));
    if (!(shares > 0)) return setError("Shares must be more than 0");
    if (!(buyPrice >= 0)) return setError("Enter the average price paid per share");

    setBusy(true);
    setError(null);
    try {
      const [first, ...rest] = [...position.lots].sort((a, b) => a.buyDate.localeCompare(b.buyDate));
      await update.mutateAsync({
        id: first.id,
        holding: { portfolioId: first.portfolioId, symbol: first.symbol, shares, buyPrice, buyDate: first.buyDate, currency: first.currency },
      });
      for (const lot of rest) await remove.mutateAsync(lot.id);
      onClose();
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const input =
    "mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:bg-background";
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-background p-0 text-foreground backdrop:bg-black/50"
    >
      {position && (
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h2 className="text-lg font-medium">Edit {position.symbol}</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Shares
              <input name="shares" type="number" step="any" min="0" required defaultValue={position.shares} className={`${input} tabular`} />
            </label>
            <label className="block text-sm">
              Avg cost ({position.currency})
              <input
                name="buyPrice"
                type="number"
                step="any"
                min="0"
                required
                defaultValue={Number(position.buyPrice.toFixed(4))}
                className={`${input} tabular`}
              />
            </label>
          </div>
          {position.lots.length > 1 && (
            <p className="rounded-lg bg-surface px-3 py-2 text-xs text-muted">
              This holding is made of {position.lots.length} purchases. Saving combines them into one purchase dated {position.buyDate} with these totals.
            </p>
          )}
          {error && <p role="alert" className="text-sm text-down">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm text-muted hover:bg-surface">
              Cancel
            </button>
            <button disabled={busy} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function Allocation({ valuations, quotes, base, fx }: { valuations: HoldingValuation[]; quotes: Record<string, Quote>; base: BaseCurrency; fx: FxRates }) {
  const [view, setView] = useState<AllocationView>(() =>
    readPref(
      ALLOCATION_KEY,
      ALLOCATION_VIEWS.map((v) => v.id),
      "holding",
    ),
  );
  const symbols = valuations.map((v) => v.holding.symbol);
  // Sector and country come from company profiles (cached for the session).
  const profiles = useQueries({
    queries: symbols.map((s) => ({ queryKey: ["profile", s], queryFn: () => api.profile(s), staleTime: Infinity })),
    combine: (results) => ({
      bySymbol: Object.fromEntries(results.map((r, i) => [symbols[i], r.data])),
      loading: results.some((r) => r.isPending),
    }),
  });
  const needsProfiles = view === "sector" || view === "country";
  const slices = allocate(
    valuations.map((v) => ({
      symbol: v.holding.symbol,
      value: convert(v.marketValue, v.holding.currency, base, fx),
      currency: v.holding.currency,
      quote: quotes[v.holding.symbol],
      profile: profiles.bySymbol[v.holding.symbol],
    })),
    view,
    fx,
  );

  function choose(v: AllocationView) {
    setView(v);
    writePref(ALLOCATION_KEY, v);
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-medium">Allocation</h2>
      <div role="radiogroup" aria-label="Group allocation by" className="mb-4 flex flex-wrap gap-1.5 text-xs">
        {ALLOCATION_VIEWS.map((v) => (
          <button
            key={v.id}
            role="radio"
            aria-checked={view === v.id}
            onClick={() => choose(v.id)}
            className={`rounded-full border px-3 py-1 ${view === v.id ? "border-accent bg-accent/10 font-medium text-accent" : "border-border text-muted hover:text-foreground"}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {needsProfiles && profiles.loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface" />
      ) : (
        <Donut slices={slices} format={(v) => formatPrice(v, base)} />
      )}
    </section>
  );
}
