import type { NewsItem } from '@pek/shared';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';

import { NewsList } from '@/components/lists';
import { ThemedText } from '@/components/themed-text';
import { Empty, Screen, Segmented, SignInPrompt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, useHoldings, useNews, useWatchlists } from '@/lib/queries';

const TABS = [
  { id: 'top', label: 'Top stories' },
  { id: 'mine', label: 'My news' },
] as const;

export default function NewsScreen() {
  const [tab, setTab] = useState<'top' | 'mine'>('top');
  const top = useNews();
  return (
    <Screen onRefresh={() => top.refetch()}>
      <ThemedText type="title">News</ThemedText>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === 'top' ? <NewsList items={top.data} loading={top.isPending} limit={25} /> : <MyNews />}
    </Screen>
  );
}

function MyNews() {
  const { user } = useAuth();
  const holdings = useHoldings();
  const watchlists = useWatchlists();
  const symbols = [
    ...new Set([...(holdings.data ?? []).map((h) => h.symbol), ...(watchlists.data ?? []).flatMap((w) => w.items.map((i) => i.symbol))]),
  ].slice(0, 12);
  const results = useQueries({
    queries: symbols.map((s) => ({ queryKey: ['news', s], queryFn: () => api.news(s), staleTime: 5 * 60_000 })),
  });

  if (!user) return <SignInPrompt what="news feed" />;
  if (!holdings.isPending && !watchlists.isPending && symbols.length === 0) {
    return <Empty text="Follow stocks or add holdings to build your news feed." />;
  }

  // Merge newest-first, de-duplicated by headline, tagged with the tickers each story came from.
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

  return (
    <NewsList
      items={items}
      loading={holdings.isPending || watchlists.isPending || results.every((r) => r.isPending)}
      limit={40}
      tagsFor={(n) => [...(tags.get(n.headline.toLowerCase()) ?? [])]}
    />
  );
}
