"use client";

import { useEffect, useRef, useState } from "react";
import { currencyOf, exchangeOf, isValidSymbol, normalizeSymbol, type Holding, type NewHolding } from "@pek/shared";
import { useHoldingMutations, usePortfolios } from "@/lib/db-queries";
import { api } from "@/lib/queries";

interface Props {
  open: boolean;
  onClose: () => void;
  /** pre-filled ticker (from a stock page); editable when omitted */
  symbol?: string;
  defaultPrice?: number;
  /** existing lot to edit */
  editing?: Holding;
  /** portfolio to preselect for a new holding (defaults to the first one) */
  portfolioId?: string;
}

// Local calendar date as YYYY-MM-DD (en-CA formats that way); toISOString would give the UTC date.
const today = () => new Date().toLocaleDateString("en-CA");

/** Modal for adding or editing one purchase lot. */
export function HoldingForm({ open, onClose, symbol, defaultPrice, editing, portfolioId }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { add, update } = useHoldingMutations();
  const portfolios = usePortfolios();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setError(null);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const sym = normalizeSymbol(String(f.get("symbol") ?? ""));
    const shares = Number(f.get("shares"));
    const buyPrice = Number(f.get("buyPrice"));
    const buyDate = String(f.get("buyDate"));
    const portfolio = String(f.get("portfolioId") ?? "");
    if (!isValidSymbol(sym)) return setError("Enter a valid ticker, e.g. AAPL, D05.SI or MC.PA");
    if (!(shares > 0)) return setError("Shares must be more than 0");
    if (!(buyPrice >= 0)) return setError("Enter the price you paid per share");
    if (buyDate > today()) return setError("Buy date can't be in the future");
    if (!portfolio) return setError("Choose a portfolio");

    setBusy(true);
    setError(null);
    try {
      // Confirms the ticker exists and gives us its trading currency.
      const quote = await api.quote(sym);
      const holding: NewHolding = { portfolioId: portfolio, symbol: quote.symbol, shares, buyPrice, buyDate, currency: quote.currency };
      if (editing) await update.mutateAsync({ id: editing.id, holding });
      else await add.mutateAsync(holding);
      onClose();
    } catch (err) {
      setError(err instanceof Error && "status" in err && err.status === 404 ? `Unknown ticker ${sym}` : "Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const sym = editing?.symbol ?? symbol;
  const currency = sym ? currencyOf(exchangeOf(sym)) : "USD";
  const input =
    "mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:bg-background";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-background p-0 text-foreground backdrop:bg-black/50"
    >
      {open && (
        <form onSubmit={onSubmit} className="space-y-4 p-6">
          <h2 className="text-lg font-medium">{editing ? "Edit holding" : "Add to portfolio"}</h2>
          <label className="block text-sm">
            Ticker
            <input
              name="symbol"
              defaultValue={sym}
              readOnly={!!sym}
              required
              placeholder="AAPL, D05.SI, MC.PA"
              className={`${input} font-mono uppercase ${sym ? "text-muted" : ""}`}
            />
          </label>
          <label className="block text-sm">
            Portfolio
            <select
              name="portfolioId"
              required
              defaultValue={editing?.portfolioId ?? portfolioId ?? portfolios.data?.[0]?.id}
              key={portfolios.data?.length}
              className={input}
            >
              {portfolios.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              Shares
              <input name="shares" type="number" step="any" min="0" required defaultValue={editing?.shares} className={`${input} tabular`} />
            </label>
            <label className="block text-sm">
              Price paid{sym ? ` (${currency})` : ""}
              <input
                name="buyPrice"
                type="number"
                step="any"
                min="0"
                required
                defaultValue={editing?.buyPrice ?? defaultPrice}
                className={`${input} tabular`}
              />
            </label>
          </div>
          <label className="block text-sm">
            Buy date
            <input name="buyDate" type="date" required max={today()} defaultValue={editing?.buyDate ?? today()} className={input} />
          </label>
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
