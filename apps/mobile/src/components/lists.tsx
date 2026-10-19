import { formatPercent, formatPrice, timeAgo, type NewsItem, type Quote } from '@pek/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, ChangePill, Skeleton, SymbolChip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useQuote } from '@/lib/queries';

export function openQuote(symbol: string) {
  router.push({ pathname: '/quote/[symbol]', params: { symbol } });
}

/** One tappable row: ticker, name, price and day change. Pass a quote, or let it fetch by symbol. */
export function QuoteRow({ symbol, quote, right }: { symbol: string; quote?: Quote; right?: React.ReactNode }) {
  const fetched = useQuote(symbol, !quote);
  const q = quote ?? fetched.data;
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => openQuote(symbol)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}
      accessibilityRole="button"
      accessibilityLabel={`${symbol}${q ? `, ${formatPrice(q.price, q.currency)}, ${formatPercent(q.changePercent)}` : ''}`}>
      <SymbolChip symbol={symbol} />
      <ThemedText type="small" numberOfLines={1} style={{ flex: 1 }}>
        {q?.name ?? ''}
      </ThemedText>
      {q ? (
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <ThemedText type="smallBold" style={{ fontVariant: ['tabular-nums'] }}>
            {formatPrice(q.price, q.currency)}
          </ThemedText>
          <ChangePill value={q.change} label={formatPercent(q.changePercent)} />
        </View>
      ) : (
        <View style={{ width: 80 }}>
          <Skeleton height={32} />
        </View>
      )}
      {right}
    </Pressable>
  );
}

export function RowList({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <Card>
      {items.map((child, i) => (
        <View key={i} style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }}>
          {child}
        </View>
      ))}
    </Card>
  );
}

export function NewsList({ items, loading, limit = 10, tagsFor }: { items?: NewsItem[]; loading: boolean; limit?: number; tagsFor?: (n: NewsItem) => string[] }) {
  const theme = useTheme();
  if (loading) {
    return (
      <View style={{ gap: Spacing.two }}>
        <Skeleton height={72} />
        <Skeleton height={72} />
        <Skeleton height={72} />
      </View>
    );
  }
  if (!items?.length) return <ThemedText type="small" themeColor="textSecondary">No recent news.</ThemedText>;

  return (
    <View>
      {items.slice(0, limit).map((n, i) => (
        <Pressable
          key={n.id}
          onPress={() => WebBrowser.openBrowserAsync(n.url)}
          accessibilityRole="link"
          style={({ pressed }) => [
            styles.news,
            i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            pressed && { opacity: 0.6 },
          ]}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {tagsFor?.(n).map((t) => <SymbolChip key={t} symbol={t} />)}
              <ThemedText type="caption" themeColor="textSecondary">
                {n.source} · {timeAgo(n.publishedAt)}
              </ThemedText>
            </View>
            <ThemedText type="smallBold" numberOfLines={3}>
              {n.headline}
            </ThemedText>
          </View>
          {n.image && <Image source={n.image} style={styles.thumb} contentFit="cover" />}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 12, minHeight: 56 },
  news: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.three },
  thumb: { width: 64, height: 64, borderRadius: 8 },
});
