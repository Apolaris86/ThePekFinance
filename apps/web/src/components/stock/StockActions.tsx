"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Quote } from "@pek/shared";
import { HoldingForm } from "@/components/HoldingForm";
import { useAuth } from "@/lib/auth";
import { useWatchlistMutations, useWatchlists } from "@/lib/db-queries";
import { supabaseConfigured } from "@/lib/supabase";

const pill = "rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:bg-surface";

/** Follow (watchlists) and Add to portfolio buttons for a stock page. */
export function StockActions({ quote }: { quote: Quote }) {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!supabaseConfigured) return null;
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={`${pill} text-accent`}>
        Sign in to follow
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <FollowMenu symbol={quote.symbol} />
      <AddHolding quote={quote} />
    </div>
  );
}

function FollowMenu({ symbol }: { symbol: string }) {
  const { data: lists = [] } = useWatchlists();
  const { addItem, removeItem, create } = useWatchlistMutations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const following = lists.some((l) => l.items.some((i) => i.symbol === symbol));

  async function quickFollow() {
    if (lists.length === 1) {
      const [l] = lists;
      const item = l.items.find((i) => i.symbol === symbol);
      if (item) removeItem.mutate(item.id);
      else addItem.mutate({ watchlistId: l.id, symbol, position: l.items.length });
    } else if (lists.length === 0) {
      const id = await create.mutateAsync({ name: "My watchlist", position: 0 });
      addItem.mutate({ watchlistId: id as string, symbol, position: 0 });
    } else {
      setOpen((o) => !o);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={quickFollow} aria-expanded={lists.length > 1 ? open : undefined} className={`${pill} ${following ? "border-accent bg-accent/10 text-accent" : "text-accent"}`}>
        {following ? "✓ Following" : "+ Follow"}
      </button>
      {open && (
        <ul className="absolute left-0 top-10 z-10 min-w-52 rounded-xl border border-border bg-background py-1 shadow-lg">
          {lists.map((l) => {
            const item = l.items.find((i) => i.symbol === symbol);
            return (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm hover:bg-surface">
                  <input
                    type="checkbox"
                    checked={!!item}
                    onChange={() =>
                      item ? removeItem.mutate(item.id) : addItem.mutate({ watchlistId: l.id, symbol, position: l.items.length })
                    }
                    className="accent-[var(--accent)]"
                  />
                  {l.name}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddHolding({ quote }: { quote: Quote }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={pill}>
        + Add to portfolio
      </button>
      <HoldingForm open={open} onClose={() => setOpen(false)} symbol={quote.symbol} defaultPrice={quote.price} />
    </>
  );
}
