"use client";

import { useEffect, useRef, useState } from "react";
import { describeAlert, isTriggered, type AlertKind } from "@pek/shared";
import { SearchBox } from "@/components/SearchBox";
import { useAlertMutations } from "@/lib/db-queries";
import { formatPercent, formatPrice } from "@/lib/format";
import { useQuote } from "@/lib/queries";

interface Props {
  open: boolean;
  onClose: () => void;
  /** pre-selected ticker (from a stock page) */
  symbol?: string;
}

const KINDS: { id: AlertKind; label: string }[] = [
  { id: "above", label: "Price rises to" },
  { id: "below", label: "Price falls to" },
  { id: "move", label: "Moves by % in a day" },
];

export function AlertForm({ open, onClose, symbol: preset }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [symbol, setSymbol] = useState(preset ?? "");
  const [kind, setKind] = useState<AlertKind>("above");
  const [threshold, setThreshold] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { create } = useAlertMutations();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  function reset() {
    setSymbol(preset ?? "");
    setKind("above");
    setThreshold("");
    setError(null);
  }

  function close() {
    reset();
    onClose();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(threshold);
    if (!symbol) return setError("Pick a stock");
    if (!(value > 0)) return setError(kind === "move" ? "Enter a percentage above 0" : "Enter a price above 0");
    try {
      await create.mutateAsync({ symbol, kind, threshold: value });
      close();
    } catch {
      setError("Couldn't save the alert. Try again.");
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={close}
      onClick={(e) => e.target === ref.current && close()}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-background p-0 text-foreground backdrop:bg-black/50"
    >
      {open && (
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h2 className="text-lg font-medium">New price alert</h2>
          {symbol ? (
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="font-mono text-sm font-semibold">{symbol}</span>
              {!preset && (
                <button type="button" onClick={() => setSymbol("")} className="text-sm text-muted hover:text-foreground">
                  Change
                </button>
              )}
            </div>
          ) : (
            <SearchBox placeholder="Search for a stock" onSelect={(item) => setSymbol(item.symbol)} />
          )}

          <fieldset>
            <legend className="text-sm">Notify me when</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {KINDS.map((k) => (
                <label
                  key={k.id}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm transition ${kind === k.id ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"}`}
                >
                  <input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} className="sr-only" />
                  {k.label}
                </label>
              ))}
            </div>
          </fieldset>

          {symbol && <ThresholdField symbol={symbol} kind={kind} value={threshold} onChange={setThreshold} />}

          {error && <p role="alert" className="text-sm text-down">{error}</p>}
          <p className="text-xs text-muted">Checked every minute on weekdays. Alerts fire once and email you, then pause until you re-arm them.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} className="rounded-full px-4 py-2 text-sm text-muted hover:bg-surface">Cancel</button>
            <button disabled={create.isPending} className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-60">
              {create.isPending ? "Saving…" : "Create alert"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function ThresholdField({ symbol, kind, value, onChange }: { symbol: string; kind: AlertKind; value: string; onChange: (v: string) => void }) {
  const { data: q } = useQuote(symbol);
  const n = Number(value);
  const rule = { symbol, kind, threshold: n };
  const metNow = q && n > 0 && kind !== "move" && isTriggered(rule, { price: q.price, changePercent: q.changePercent, marketState: q.marketState });
  const input =
    "mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:bg-background";

  return (
    <div>
      <label className="block text-sm">
        {kind === "move" ? "Percent move (up or down)" : `Price${q ? ` (${q.currency})` : ""}`}
        <input
          type="number"
          step="any"
          min="0"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={kind === "move" ? "5" : q ? String(q.price) : ""}
          className={`${input} tabular`}
        />
      </label>
      {q && (
        <p className="mt-1.5 text-xs text-muted">
          Now {formatPrice(q.price, q.currency)} ({formatPercent(q.changePercent)} today)
          {n > 0 && kind !== "move" && ` · ${formatPercent(((n - q.price) / q.price) * 100)} away`}
        </p>
      )}
      {n > 0 && <p className="mt-1 text-xs">{describeAlert(rule, q?.currency)}</p>}
      {metNow && <p className="mt-1 text-xs text-down">The price already meets this, so it will fire on the next check.</p>}
    </div>
  );
}
