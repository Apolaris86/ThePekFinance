"use client";

import Link from "next/link";
import { formatPercent, formatPrice } from "@/lib/format";
import { useQuote } from "@/lib/queries";

export function TickerCard({ symbol }: { symbol: string }) {
  const { data: q, isError } = useQuote(symbol);
  const up = (q?.change ?? 0) >= 0;
  return (
    <Link
      href={`/quote/${encodeURIComponent(symbol)}`}
      className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 transition hover:bg-surface"
    >
      <div className="min-w-0">
        <p className="font-mono text-xs font-semibold">{symbol}</p>
        <p className="truncate text-sm text-muted">{q?.name ?? (isError ? "Unavailable" : " ")}</p>
      </div>
      {q ? (
        <div className="shrink-0 text-right">
          <p className="tabular text-sm font-medium">{formatPrice(q.price, q.currency)}</p>
          <p className={`tabular text-xs font-medium ${up ? "text-up" : "text-down"}`}>{formatPercent(q.changePercent)}</p>
        </div>
      ) : (
        !isError && <div className="h-8 w-16 animate-pulse rounded bg-surface" />
      )}
    </Link>
  );
}
