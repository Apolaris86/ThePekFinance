import { formatNumber, formatPercent, type Exchange, type Quote } from '@pek/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Sparkline } from '@/components/charts';
import { NewsList, openQuote, QuoteRow, RowList } from '@/components/lists';
import { ThemedText } from '@/components/themed-text';
import { Card, Screen, SearchBar, Section, Segmented, Skeleton } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { useHistory, useMovers, useNews, useQuotes } from '@/lib/queries';

const INDICES = [
  { symbol: '^GSPC', name: 'S&P 500' },
  { symbol: '^IXIC', name: 'Nasdaq' },
  { symbol: '^DJI', name: 'Dow Jones' },
  { symbol: '^STI', name: 'STI' },
  { symbol: '^FCHI', name: 'CAC 40' },
];

const MARKETS = [
  { id: 'US', label: 'US' },
  { id: 'SGX', label: 'Singapore' },
  { id: 'EPA', label: 'Paris' },
] as const;

const LISTS = [
  { id: 'gainers', label: 'Gainers' },
  { id: 'losers', label: 'Losers' },
  { id: 'active', label: 'Most active' },
] as const;

export default function MarketsScreen() {
  const qc = useQueryClient();
  const indices = useQuotes(INDICES.map((i) => i.symbol));
  const news = useNews();
  const bySymbol = Object.fromEntries((indices.data ?? []).map((q) => [q.symbol, q]));

  return (
    <Screen onRefresh={() => qc.invalidateQueries()}>
      <View style={styles.titleRow}>
        <ThemedText type="title">
          The<ThemedText type="title" themeColor="accent">Pek</ThemedText>Finance
        </ThemedText>
        <AccountButton />
      </View>
      <SearchBar />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
        {INDICES.map((i) => (
          <IndexCard key={i.symbol} symbol={i.symbol} name={i.name} quote={bySymbol[i.symbol]} />
        ))}
      </ScrollView>

      <Movers />

      <Section title="Market news">
        <NewsList items={news.data} loading={news.isPending} limit={6} />
      </Section>
    </Screen>
  );
}

function IndexCard({ symbol, name, quote }: { symbol: string; name: string; quote?: Quote }) {
  const theme = useTheme();
  const { data: candles = [] } = useHistory(symbol, '1D');
  const up = (quote?.change ?? 0) >= 0;
  return (
    <Pressable onPress={() => openQuote(symbol)} accessibilityRole="button" accessibilityLabel={name}>
      <Card style={styles.index}>
        <ThemedText type="smallBold">{name}</ThemedText>
        {quote ? (
          <>
            <ThemedText style={{ fontVariant: ['tabular-nums'] }}>{formatNumber(quote.price)}</ThemedText>
            <ThemedText type="caption" style={{ color: up ? theme.up : theme.down, fontVariant: ['tabular-nums'] }}>
              {formatPercent(quote.changePercent)}
            </ThemedText>
          </>
        ) : (
          <Skeleton height={40} />
        )}
        <Sparkline candles={candles} baseline={quote?.previousClose} width={120} height={32} />
      </Card>
    </Pressable>
  );
}

function Movers() {
  const [market, setMarket] = useState<Exchange>('US');
  const [list, setList] = useState<(typeof LISTS)[number]['id']>('gainers');
  const { data, isPending } = useMovers(market);
  const items = data?.[list] ?? [];

  return (
    <Section title="Market movers">
      <Segmented options={MARKETS} value={market} onChange={setMarket} />
      <Segmented options={LISTS} value={list} onChange={setList} />
      {isPending ? (
        <View style={{ gap: Spacing.two }}>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </View>
      ) : items.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">No data right now.</ThemedText>
      ) : (
        <RowList>
          {items.slice(0, 6).map((q) => (
            <QuoteRow key={q.symbol} symbol={q.symbol} quote={q} />
          ))}
        </RowList>
      )}
    </Section>
  );
}

function AccountButton() {
  const { user } = useAuth();
  return (
    <Pressable onPress={() => router.push('/login')} hitSlop={10} accessibilityRole="button">
      <ThemedText type="smallBold" themeColor="accent">{user ? 'Account' : 'Sign in'}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  index: { width: 148, padding: Spacing.three, gap: 2, borderRadius: Radius.lg },
});
