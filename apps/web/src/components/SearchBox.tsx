"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { SearchResult } from "@pek/shared";
import { useSearch } from "@/lib/queries";

const RECENT_KEY = "pek.recentSearches";
const EXCHANGE_LABEL = { US: "US", SGX: "SGX", EPA: "Paris" } as const;

function readRecent(): SearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveRecent(item: SearchResult) {
  try {
    const next = [item, ...readRecent().filter((r) => r.symbol !== item.symbol)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: recent searches are a convenience only
  }
}

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchBox() {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const boxRef = useRef<HTMLDivElement>(null);
  const query = useDebounced(text.trim(), 200);
  const { data: results = [], isFetching } = useSearch(query);

  const typed = text.trim();
  const items = typed ? results : recent;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(item: SearchResult) {
    saveRecent(item);
    setOpen(false);
    setText("");
    router.push(`/quote/${encodeURIComponent(item.symbol)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (items[active]) go(items[active]);
      else if (typed) router.push(`/quote/${encodeURIComponent(typed.toUpperCase())}`);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showEmpty = open && typed && !isFetching && results.length === 0 && query === typed;

  return (
    <div ref={boxRef} className="relative">
      <input
        type="search"
        role="combobox"
        aria-expanded={open && items.length > 0}
        aria-controls={listId}
        aria-label="Search stocks"
        placeholder="Search for stocks, ETFs & more"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => {
          setRecent(readRecent());
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-full border border-border bg-surface px-5 text-sm outline-none transition focus:border-accent focus:bg-background focus:shadow-md"
      />
      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-12 overflow-hidden rounded-2xl border border-border bg-background py-2 shadow-lg"
        >
          {!typed && <li className="px-5 pb-1 text-xs font-medium text-muted">Recent</li>}
          {items.map((item, i) => (
            <li
              key={item.symbol}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(item);
              }}
              className={`flex cursor-pointer items-center gap-3 px-5 py-2 text-sm ${i === active ? "bg-surface" : ""}`}
            >
              <span className="w-20 shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-center font-mono text-xs font-semibold text-accent">
                {item.symbol}
              </span>
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="shrink-0 text-xs text-muted">{EXCHANGE_LABEL[item.exchange]}</span>
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <div className="absolute inset-x-0 top-12 rounded-2xl border border-border bg-background px-5 py-3 text-sm text-muted shadow-lg">
          No US, SGX or Paris matches for &ldquo;{typed}&rdquo;
        </div>
      )}
    </div>
  );
}
