"use client";

import { useState } from "react";
import type { AllocationSlice } from "@pek/shared";

const INITIAL_ROWS = 10;
const MAX_TOOLTIP_MEMBERS = 8;

/**
 * Horizontal bars, one per group, sized by share of the portfolio. Single measure,
 * so one hue and no legend; the share sits at each bar's tip. Hovering or focusing
 * a row shows the holdings behind it.
 */
export function AllocationBars({ slices, format }: { slices: AllocationSlice[]; format: (v: number) => string }) {
  const [active, setActive] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  const max = slices[0]?.value ?? 0;
  const rows = showAll ? slices : slices.slice(0, INITIAL_ROWS);
  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;

  return (
    <div>
      <ul className="space-y-0.5" aria-label="Portfolio allocation">
        {rows.map((s, i) => (
          <li
            key={s.label}
            tabIndex={0}
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive((a) => (a === i ? null : a))}
            onFocus={() => setActive(i)}
            onBlur={() => setActive((a) => (a === i ? null : a))}
            aria-label={`${s.label}: ${pct(s.value)}, ${format(s.value)}`}
            className="relative grid cursor-default grid-cols-[minmax(0,10rem)_1fr] items-center gap-3 rounded-lg px-1 py-1.5 outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="line-clamp-2 text-sm leading-tight" title={s.label}>
              {s.label}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className={`h-3.5 shrink-0 rounded-r bg-accent transition ${active === i ? "opacity-100 ring-2 ring-accent/30" : active === null ? "opacity-90" : "opacity-60"}`}
                // Bars use up to 75% of the track so the share label always fits at the tip.
                style={{ width: `${Math.max((s.value / max) * 75, 1)}%` }}
              />
              <span className="tabular shrink-0 text-xs font-medium">{pct(s.value)}</span>
            </span>
            {active === i && <Tooltip slice={s} total={total} format={format} pct={pct} />}
          </li>
        ))}
      </ul>
      {slices.length > INITIAL_ROWS && (
        <button onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm text-accent hover:underline">
          {showAll ? "Show fewer" : `Show all ${slices.length}`}
        </button>
      )}
    </div>
  );
}

function Tooltip({
  slice,
  total,
  format,
  pct,
}: {
  slice: AllocationSlice;
  total: number;
  format: (v: number) => string;
  pct: (v: number) => string;
}) {
  const shown = slice.members.slice(0, MAX_TOOLTIP_MEMBERS);
  const more = slice.members.length - shown.length;
  const guessed = slice.members.some((m) => m.auto);
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-border bg-background p-3 text-xs shadow-lg"
    >
      <p className="tabular text-sm font-semibold">
        {format(slice.value)} <span className="font-normal text-muted">· {pct(slice.value)} of portfolio</span>
      </p>
      <p className="text-muted">{slice.label}</p>
      {(slice.members.length > 1 || slice.members[0]?.symbol !== slice.label) && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {shown.map((m) => (
            <li key={m.symbol} className="flex items-baseline gap-2">
              <span className="tabular w-20 shrink-0 font-medium">{format(m.value)}</span>
              <span className="font-mono font-semibold">{m.symbol}</span>
              <span className="min-w-0 flex-1 truncate text-muted">{m.name}</span>
              <span className="tabular shrink-0 text-muted">
                {pct(m.value)}
                {m.auto ? "*" : ""}
              </span>
            </li>
          ))}
          {more > 0 && <li className="text-muted">+{more} more</li>}
        </ul>
      )}
      {slice.members.length === 1 && slice.members[0].symbol === slice.label && slice.members[0].name && (
        <p className="mt-1">{slice.members[0].name}</p>
      )}
      {guessed && <p className="mt-2 text-muted">* Not in your classification list yet, so grouped by its sector.</p>}
      <p className="sr-only">Total portfolio {format(total)}</p>
    </div>
  );
}
