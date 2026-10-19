import { useState } from 'react';
import { Pressable } from 'react-native';

import { QuoteRow, RowList } from '@/components/lists';
import { ThemedText } from '@/components/themed-text';
import { Empty, Screen, SearchBar, Segmented, SignInPrompt, Skeleton } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useMutations, useWatchlists } from '@/lib/queries';

export default function WatchlistScreen() {
  const { user } = useAuth();
  const lists = useWatchlists();
  const { unfollow } = useMutations();
  const [selected, setSelected] = useState<string | null>(null);

  const current = lists.data?.find((l) => l.id === selected) ?? lists.data?.[0];

  return (
    <Screen onRefresh={() => lists.refetch()}>
      <ThemedText type="title">Watchlist</ThemedText>
      <SearchBar />
      {!user ? (
        <SignInPrompt what="watchlists" />
      ) : lists.isPending ? (
        <Skeleton height={200} />
      ) : !current ? (
        <Empty text="No watchlists yet. Open a stock and tap Follow." />
      ) : (
        <>
          {lists.data!.length > 1 && (
            <Segmented
              options={lists.data!.map((l) => ({ id: l.id, label: `${l.name} · ${l.items.length}` }))}
              value={current.id}
              onChange={setSelected}
            />
          )}
          {current.items.length === 0 ? (
            <Empty text="No stocks yet. Search for one and tap Follow." />
          ) : (
            <RowList>
              {current.items.map((item) => (
                <QuoteRow
                  key={item.id}
                  symbol={item.symbol}
                  right={
                    <Pressable
                      hitSlop={10}
                      onPress={() => unfollow.mutate(item.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.symbol}`}>
                      <ThemedText themeColor="textSecondary">✕</ThemedText>
                    </Pressable>
                  }
                />
              ))}
            </RowList>
          )}
        </>
      )}
    </Screen>
  );
}
