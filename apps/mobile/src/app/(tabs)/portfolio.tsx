import {
  formatNumber,
  formatPercent,
  formatPrice,
  formatSignedPrice,
  groupLots,
  summarize,
  valueHolding,
  type Currency,
  type Quote,
} from '@pek/shared';
import { useQueries } from '@tanstack/react-query';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AiCard } from '@/components/ai-card';
import { openQuote, RowList } from '@/components/lists';
import { ThemedText } from '@/components/themed-text';
import { Card, Empty, Screen, Segmented, SignInPrompt, Skeleton, SymbolChip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { api, useBaseCurrency, useFx, useHoldings, useMutations } from '@/lib/queries';

const CURRENCIES = [
  { id: 'USD', label: 'USD' },
  { id: 'SGD', label: 'SGD' },
  { id: 'EUR', label: 'EUR' },
] as const;

export default function PortfolioScreen() {
  const { user } = useAuth();
  const holdings = useHoldings();
  const base = useBaseCurrency();
  const fx = useFx();
  const { setBase, deleteHolding } = useMutations();
  const theme = useTheme();

  const lots = holdings.data ?? [];
  const symbols = [...new Set(lots.map((l) => l.symbol))];
  const quotes = useQueries({
    queries: symbols.map((s) => ({ queryKey: ['quote', s], queryFn: () => api.quote(s), refetchInterval: 30_000 })),
    combine: (rs) => Object.fromEntries(rs.flatMap((r, i) => (r.data ? [[symbols[i], r.data]] : []))) as Record<string, Quote>,
  });

  const header = <ThemedText type="title">Portfolio</ThemedText>;
  if (!user) return <Screen>{header}<SignInPrompt what="portfolio" /></Screen>;
  if (holdings.isPending || base.isPending) return <Screen>{header}<Skeleton height={160} /></Screen>;
  if (lots.length === 0) {
    return (
      <Screen onRefresh={() => holdings.refetch()}>
        {header}
        <Empty text="No holdings yet. Open any stock and tap Add to portfolio." />
      </Screen>
    );
  }

  const baseCcy: Currency = base.data ?? 'USD';
  const positions = groupLots(lots);
  const valuations = positions.flatMap((p) => (quotes[p.symbol] ? [valueHolding(p, quotes[p.symbol].price, quotes[p.symbol].previousClose)] : []));
  const ready = fx.data && valuations.length === positions.length;
  const s = ready ? summarize(valuations, baseCcy, fx.data!) : null;
  const tone = (v: number) => ({ color: v >= 0 ? theme.up : theme.down });

  function confirmDelete(id: string, label: string) {
    Alert.alert('Delete holding?', label, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHolding.mutate(id) },
    ]);
  }

  return (
    <Screen onRefresh={() => Promise.all([holdings.refetch(), fx.refetch()])}>
      {header}
      <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
        <ThemedText type="small" themeColor="textSecondary">Total value</ThemedText>
        {s ? (
          <>
            <ThemedText type="big">{formatPrice(s.marketValue, baseCcy)}</ThemedText>
            <View style={styles.statsRow}>
              <View>
                <ThemedText type="caption" themeColor="textSecondary">Day change</ThemedText>
                <ThemedText type="smallBold" style={tone(s.dayChange)}>
                  {formatSignedPrice(s.dayChange, baseCcy)} ({formatPercent((s.dayChange / (s.marketValue - s.dayChange || 1)) * 100)})
                </ThemedText>
              </View>
              <View>
                <ThemedText type="caption" themeColor="textSecondary">Total gain</ThemedText>
                <ThemedText type="smallBold" style={tone(s.gain)}>
                  {formatSignedPrice(s.gain, baseCcy)} ({formatPercent(s.gainPercent)})
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <Skeleton height={60} />
        )}
        <Segmented options={CURRENCIES} value={baseCcy} onChange={(c) => setBase.mutate(c)} />
      </Card>

      <AiCard
        title="Today's digest"
        cta="Write today's portfolio digest"
        queryKey={['ai', 'digest', lots.map((l) => `${l.id}:${l.shares}:${l.buyPrice}`).join('|')]}
        fetcher={api.portfolioDigest}
      />

      <ThemedText type="heading">Holdings</ThemedText>
      <RowList>
        {valuations.map((v) => {
          const p = v.holding as (typeof positions)[number];
          const q = quotes[p.symbol];
          return (
            <View key={p.symbol} style={{ padding: Spacing.three, gap: Spacing.two }}>
              <Pressable onPress={() => openQuote(p.symbol)} style={styles.holdingTop} accessibilityRole="button">
                <SymbolChip symbol={p.symbol} />
                <ThemedText type="small" numberOfLines={1} style={{ flex: 1 }}>{q?.name}</ThemedText>
                <ThemedText type="smallBold" style={{ fontVariant: ['tabular-nums'] }}>{formatPrice(v.marketValue, p.currency)}</ThemedText>
              </Pressable>
              <View style={styles.holdingBottom}>
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatNumber(p.shares, p.shares % 1 ? 4 : 0)} @ {formatPrice(p.buyPrice, p.currency)} · now {formatPrice(v.price, p.currency)}
                </ThemedText>
                <ThemedText type="caption" style={[tone(v.gain), { fontWeight: '600' }]}>
                  {formatSignedPrice(v.gain, p.currency)} ({formatPercent(v.gainPercent)})
                </ThemedText>
              </View>
              {p.lots.map((lot) => (
                <Pressable
                  key={lot.id}
                  onLongPress={() => confirmDelete(lot.id, `${lot.shares} ${lot.symbol} bought ${lot.buyDate}`)}
                  accessibilityHint="Long-press to delete this purchase">
                  <ThemedText type="caption" themeColor="textSecondary">
                    · Bought {lot.buyDate}: {formatNumber(lot.shares, lot.shares % 1 ? 4 : 0)} @ {formatPrice(lot.buyPrice, p.currency)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          );
        })}
      </RowList>
      <ThemedText type="caption" themeColor="textSecondary">Long-press a purchase to delete it. Values are in each stock&apos;s own currency.</ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.four, flexWrap: 'wrap' },
  holdingTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  holdingBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, flexWrap: 'wrap' },
});
