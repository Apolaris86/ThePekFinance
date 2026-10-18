"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import type { NewsItem } from "@pek/shared";
import { NewsList } from "@/components/NewsList";
import { useAuth } from "@/lib/auth";
import { useHoldings, useWatchlists } from "@/lib/db-queries";
import { api, useNews } from "@/lib/queries";

const MAX_SYMBOLS = 12;

export function NewsView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"top" | "mine">("top");
  const tabs = [
    { id: "top" as const, label: "Top stories" },
    { id: "mine" as const, label: "My news" },
  ];

  return (
    <>
      <div role="tablist" className="mt-4 flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-2">
        {tab === "top" ? (
          <TopStories />
        ) : user ? (
          <MyNews />
        ) : (
          <p className="py-10 text-center text-sm text-muted">
            <Link href="/login?next=/news" className="text-accent hover:underline">Sign in</Link> to see news about your holdings and watchlist.
          </p>
        )}
      </div>
    </>
  );
}

function TopStories() {
  const { data, isPending } = useNews();
  return <NewsList items={data} loading={isPending} limit={20} />;
}

/** News for every holding and watchlist symbol, merged newest-first and tagged by ticker. */
function MyNews() {
  const holdings = useHoldings();
  const watchlists = useWatchlists();
  const symbols = [
    ...new Set([...(holdings.data ?? []).map((h) => h.symbol), ...(watchlists.data ?? []).flatMap((w) => w.items.map((i) => i.symbol))]),
  ].slice(0, MAX_SYMBOLS);

  const results = useQueries({
    queries: symbols.map((s) => ({ queryKey: ["news", s], queryFn: () => api.news(s), staleTime: 5 * 60_000 })),
  });

  if (holdings.isPending || watchlists.isPending) return <NewsList items={undefined} loading />;
  if (symbols.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">Follow stocks or add holdings to build your news feed.</p>;
  }

  // Merge, de-duplicate by headline, remember which of your tickers each story came from.
  const tags = new Map<string, Set<string>>();
  const byHeadline = new Map<string, NewsItem>();
  results.forEach((r, i) => {
    for (const n of r.data ?? []) {
      const key = n.headline.toLowerCase();
      if (!byHeadline.has(key)) byHeadline.set(key, n);
      tags.set(key, (tags.get(key) ?? new Set()).add(symbols[i]));
    }
  });
  const items = [...byHeadline.values()].sort((a, b) => b.publishedAt - a.publishedAt);
  const loading = results.every((r) => r.isPending);

  return (
    <>
      <p className="mt-2 text-xs text-muted">From {symbols.join(", ")}</p>
      <NewsList
        items={items}
        loading={loading}
        limit={40}
        tagsFor={(n) => [...(tags.get(n.headline.toLowerCase()) ?? [])]}
        empty="No recent news for your stocks."
      />
    </>
  );
}
