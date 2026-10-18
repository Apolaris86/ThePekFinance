"use client";

import Link from "next/link";
import { useState } from "react";
import type { Watchlist, WatchlistItem } from "@pek/shared";
import { formatPercent, formatPrice, formatSigned } from "@/lib/format";
import { useWatchlistMutations, useWatchlists } from "@/lib/db-queries";
import { useQuote } from "@/lib/queries";

const SELECTED_KEY = "pek.selectedWatchlist";

function readSelected() {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function WatchlistView() {
  const { data: lists, isPending, isError } = useWatchlists();
  const m = useWatchlistMutations();
  // Only mounts in the browser (behind RequireAuth), so localStorage is available.
  const [selectedId, setSelectedId] = useState<string | null>(readSelected);

  function select(id: string) {
    setSelectedId(id);
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {
      // remembering the tab is a convenience only
    }
  }

  if (isPending) return <div className="h-64 animate-pulse rounded-xl bg-surface" />;
  if (isError) return <p className="text-down">Couldn&apos;t load your watchlists.</p>;

  const current = lists.find((l) => l.id === selectedId) ?? lists[0];

  async function newList() {
    const name = prompt("Name for the new watchlist")?.trim();
    if (!name) return;
    const id = await m.create.mutateAsync({ name: name.slice(0, 60), position: lists!.length });
    select(id as string);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-normal">Watchlists</h1>
        <button onClick={newList} className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-accent hover:bg-surface">
          + New list
        </button>
      </div>

      {lists.length > 0 && (
        <div role="tablist" className="mt-4 flex gap-2 overflow-x-auto">
          {lists.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={l.id === current?.id}
              onClick={() => select(l.id)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${
                l.id === current?.id ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
              }`}
            >
              {l.name} <span className="ml-1 text-xs opacity-70">{l.items.length}</span>
            </button>
          ))}
        </div>
      )}

      {current ? <ListPanel list={current} /> : <Empty text="Create a watchlist to start following stocks." />}
    </div>
  );
}

function ListPanel({ list }: { list: Watchlist }) {
  const m = useWatchlistMutations();

  function rename() {
    const name = prompt("Rename watchlist", list.name)?.trim();
    if (name && name !== list.name) m.rename.mutate({ id: list.id, name: name.slice(0, 60) });
  }

  function remove() {
    if (confirm(`Delete "${list.name}" and its ${list.items.length} stocks?`)) m.remove.mutate(list.id);
  }

  function move(index: number, delta: number) {
    const items = [...list.items];
    const [item] = items.splice(index, 1);
    items.splice(index + delta, 0, item);
    m.reorder.mutate(items);
  }

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-end gap-3 text-sm">
        <button onClick={rename} className="text-muted hover:text-foreground">Rename</button>
        <button onClick={remove} className="text-muted hover:text-down">Delete list</button>
      </div>
      {list.items.length === 0 ? (
        <Empty text="No stocks yet. Search for one above and press Follow on its page." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {list.items.map((item, i) => (
            <Row
              key={item.id}
              item={item}
              onUp={i > 0 ? () => move(i, -1) : undefined}
              onDown={i < list.items.length - 1 ? () => move(i, 1) : undefined}
              onRemove={() => m.removeItem.mutate(item.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ item, onUp, onDown, onRemove }: { item: WatchlistItem; onUp?: () => void; onDown?: () => void; onRemove: () => void }) {
  const { data: q } = useQuote(item.symbol);
  const up = (q?.change ?? 0) >= 0;
  const iconBtn = "rounded p-1.5 text-muted hover:bg-surface hover:text-foreground disabled:invisible";
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Link href={`/quote/${encodeURIComponent(item.symbol)}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="w-20 shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-center font-mono text-xs font-semibold text-accent">
          {item.symbol}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">{q?.name ?? ""}</span>
      </Link>
      {q ? (
        <div className="tabular w-28 shrink-0 text-right text-sm sm:w-56">
          <span className="font-medium">{formatPrice(q.price, q.currency)}</span>
          <span className={`ml-3 hidden sm:inline ${up ? "text-up" : "text-down"}`}>{formatSigned(q.change)}</span>
          <span className={`ml-3 block sm:inline ${up ? "text-up" : "text-down"}`}>{formatPercent(q.changePercent)}</span>
        </div>
      ) : (
        <div className="h-5 w-28 shrink-0 animate-pulse rounded bg-surface sm:w-56" />
      )}
      <div className="flex shrink-0">
        <button aria-label="Move up" disabled={!onUp} onClick={onUp} className={iconBtn}>↑</button>
        <button aria-label="Move down" disabled={!onDown} onClick={onDown} className={iconBtn}>↓</button>
        <button aria-label={`Remove ${item.symbol}`} onClick={onRemove} className={`${iconBtn} hover:text-down`}>✕</button>
      </div>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-6 rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">{text}</p>;
}
