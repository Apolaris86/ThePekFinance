import {
  CHART_RANGES,
  formatCompact,
  formatNumber,
  formatPercent,
  formatPrice,
  formatSigned,
  normalizeSymbol,
  timezoneOf,
  type ChartRange,
  type Quote,
} from '@pek/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AiCard } from '@/components/ai-card';
import { AreaChart } from '@/components/charts';
import { AlertSheet, HoldingSheet } from '@/components/forms';
import { NewsList, RowList } from '@/components/lists';
import { ThemedText } from '@/components/themed-text';
import { Button, ChangePill, Empty, Screen, Section, Segmented, Skeleton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { api, useHistory, useMutations, useNews, useProfile, useQuote, useWatchlists } from '@/lib/queries';

const STATE = { PRE: 'Pre-market', REGULAR: 'Market open', POST: 'After hours', CLOSED: 'Closed' } as const;

export default function QuoteScreen() {
  const { symbol: raw } = useLocalSearchParams<{ symbol: string }>();
  const symbol = normalizeSymbol(raw ?? '');
  const quote = useQuote(symbol);
  const news = useNews(symbol);

  return (
    <>
      <Stack.Screen options={{ title: symbol }} />
      <Screen edges={[]} onRefresh={() => Promise.all([quote.refetch(), news.refetch()])}>
        {quote.isPending ? (
          <Skeleton height={300} />
        ) : quote.isError ? (
          <Empty text={`Couldn't load ${symbol}. SGX tickers end in .SI and Paris tickers in .PA.`} />
        ) : (
          <>
            <Header quote={quote.data} />
            <Actions quote={quote.data} />
            <Chart quote={quote.data} />
            <AiCard
              title="AI summary"
              cta={`Summarize today for ${symbol}`}
              queryKey={['ai', 'summary', symbol]}
              fetcher={() => api.stockSummary(symbol)}
            />
            <Stats quote={quote.data} />
            <About symbol={symbol} />
            <Section title="News">
              <NewsList items={news.data} loading={news.isPending} />
            </Section>
          </>
        )}
      </Screen>
    </>
  );
}

function Header({ quote: q }: { quote: Quote }) {
  const theme = useTheme();
  const asOf = new Intl.DateTimeFormat('en-US', { timeZone: timezoneOf(q.exchange), month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(q.timestamp);
  return (
    <View style={{ gap: Spacing.one }}>
      <ThemedText type="heading">{q.name ?? q.symbol}</ThemedText>
      <ThemedText type="big">{formatPrice(q.price, q.currency)}</ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <ChangePill value={q.change} label={`${q.change >= 0 ? '▲' : '▼'} ${formatPercent(q.changePercent)}`} />
        <ThemedText type="smallBold" style={{ color: q.change >= 0 ? theme.up : theme.down }}>
          {formatSigned(q.change)} today
        </ThemedText>
      </View>
      <ThemedText type="caption" themeColor="textSecondary">
        {q.marketState ? `${STATE[q.marketState]} · ` : ''}
        {asOf} · {q.currency}
        {q.delayed ? ' · Delayed' : ''}
      </ThemedText>
    </View>
  );
}

function Actions({ quote }: { quote: Quote }) {
  const { user } = useAuth();
  const lists = useWatchlists();
  const { follow, unfollow } = useMutations();
  const [sheet, setSheet] = useState<'holding' | 'alert' | null>(null);

  if (!user) return <Button title="Sign in to follow, track and set alerts" onPress={() => router.push('/login')} />;

  const list = lists.data?.[0];
  const item = list?.items.find((i) => i.symbol === quote.symbol);
  return (
    <View style={styles.actions}>
      <View style={{ flex: 1 }}>
        <Button
          title={item ? '✓ Following' : '+ Follow'}
          variant={item ? 'secondary' : 'primary'}
          disabled={!list}
          onPress={() => (item ? unfollow.mutate(item.id) : list && follow.mutate({ watchlistId: list.id, symbol: quote.symbol, position: list.items.length }))}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Button title="+ Portfolio" onPress={() => setSheet('holding')} />
      </View>
      <View style={{ flex: 1 }}>
        <Button title="🔔 Alert" onPress={() => setSheet('alert')} />
      </View>
      <HoldingSheet quote={quote} visible={sheet === 'holding'} onClose={() => setSheet(null)} />
      <AlertSheet quote={quote} visible={sheet === 'alert'} onClose={() => setSheet(null)} />
    </View>
  );
}

function Chart({ quote }: { quote: Quote }) {
  const [range, setRange] = useState<ChartRange>('1D');
  const { data: candles = [], isPending } = useHistory(quote.symbol, range);
  return (
    <View style={{ gap: Spacing.three }}>
      <Segmented options={CHART_RANGES.map((r) => ({ id: r, label: r }))} value={range} onChange={setRange} />
      {isPending ? <Skeleton height={220} /> : <AreaChart candles={candles} baseline={range === '1D' ? quote.previousClose : undefined} />}
    </View>
  );
}

function Stats({ quote: q }: { quote: Quote }) {
  const p = (v?: number) => (v == null ? '—' : formatPrice(v, q.currency));
  const rows: [string, string][] = [
    ['Previous close', p(q.previousClose)],
    ['Open', p(q.open)],
    ['Day range', q.dayLow != null && q.dayHigh != null ? `${p(q.dayLow)} – ${p(q.dayHigh)}` : '—'],
    ['52-week range', q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null ? `${p(q.fiftyTwoWeekLow)} – ${p(q.fiftyTwoWeekHigh)}` : '—'],
    ['Market cap', q.marketCap ? formatCompact(q.marketCap, q.currency) : '—'],
    ['Volume', q.volume ? formatCompact(q.volume) : '—'],
    ['P/E ratio', q.peRatio ? formatNumber(q.peRatio) : '—'],
    ['Dividend yield', q.dividendYield ? `${formatNumber(q.dividendYield * 100)}%` : '—'],
  ];
  return (
    <Section title="Key stats">
      <RowList>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.stat}>
            <ThemedText type="small" themeColor="textSecondary">{k}</ThemedText>
            <ThemedText type="smallBold" style={{ fontVariant: ['tabular-nums'], flexShrink: 1, textAlign: 'right' }}>{v}</ThemedText>
          </View>
        ))}
      </RowList>
    </Section>
  );
}

function About({ symbol }: { symbol: string }) {
  const { data: profile } = useProfile(symbol);
  const [expanded, setExpanded] = useState(false);
  if (!profile?.description) return null;
  return (
    <Section title="About">
      <ThemedText type="small" themeColor="textSecondary" numberOfLines={expanded ? undefined : 4}>
        {profile.description}
      </ThemedText>
      <Button title={expanded ? 'Show less' : 'Read more'} variant="ghost" onPress={() => setExpanded((e) => !e)} />
      {profile.sector && (
        <ThemedText type="caption" themeColor="textSecondary">
          {profile.sector} · {profile.industry}
          {profile.country ? ` · ${profile.country}` : ''}
        </ThemedText>
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.two },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 12 },
});
