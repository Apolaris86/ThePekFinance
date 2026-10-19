import {
  BASE_CURRENCIES,
  convert,
  formatNumber,
  formatPercent,
  formatPrice,
  formatSignedPrice,
  GAIN_PERIODS,
  groupLots,
  portfolioSeries,
  sumPeriodChanges,
  summarize,
  valueHolding,
  type BaseCurrency,
  type ChartRange,
  type FxRates,
  type GainPeriod,
  type Holding,
  type Position,
  type Quote,
} from '@pek/shared';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AiCard } from '@/components/ai-card';
import { AreaChart } from '@/components/charts';
import { HoldingSheet } from '@/components/forms';
import { openQuote, RowList } from '@/components/lists';
import { ThemedText } from '@/components/themed-text';
import { Card, Empty, Screen, Segmented, SignInPrompt, Skeleton, SymbolChip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { api, useBaseCurrency, useFx, useHistories, useHoldings, useMutations, usePeriodChanges, usePortfolios } from '@/lib/queries';

const CURRENCIES = BASE_CURRENCIES.map((c) => ({ id: c, label: c }));
const PERIODS = GAIN_PERIODS.map((p) => ({ id: p, label: p }));
const CHART_RANGES = (['1M', '6M', 'YTD', '1Y', '2Y'] as const).map((r) => ({ id: r, label: r }));
const SELECTED_KEY = 'pek.portfolio';

function readSelected(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export default function PortfolioScreen() {
  const { user } = useAuth();
  const portfolios = usePortfolios();
  const holdings = useHoldings();
  const base = useBaseCurrency();
  const fx = useFx();
  const { setBase } = useMutations();
  const theme = useTheme();
  const [selected, setSelected] = useState<string | null>(readSelected);
  const [period, setPeriod] = useState<GainPeriod>('1D');
  const [editing, setEditing] = useState<Holding | null>(null);

  const portfolio = portfolios.data?.find((p) => p.id === selected) ?? portfolios.data?.[0];
  const lots = (holdings.data ?? []).filter((l) => l.portfolioId === portfolio?.id);
  const symbols = [...new Set(lots.map((l) => l.symbol))];
  const quotes = useQueries({
    queries: symbols.map((s) => ({ queryKey: ['quote', s], queryFn: () => api.quote(s), refetchInterval: 30_000 })),
    combine: (rs) => Object.fromEntries(rs.flatMap((r, i) => (r.data ? [[symbols[i], r.data]] : []))) as Record<string, Quote>,
  });
  const positions = groupLots(lots);
  const periodChanges = usePeriodChanges(positions, quotes, period);

  function select(id: string) {
    setSelected(id);
    try {
      localStorage.setItem(SELECTED_KEY, id);
    } catch {}
  }

  const header = <ThemedText type="title">Portfolio</ThemedText>;
  if (!user) return <Screen>{header}<SignInPrompt what="portfolio" /></Screen>;
  if (holdings.isPending || base.isPending || portfolios.isPending) return <Screen>{header}<Skeleton height={160} /></Screen>;

  const tabs = portfolio && (
    <Segmented options={(portfolios.data ?? []).map((p) => ({ id: p.id, label: p.name }))} value={portfolio.id} onChange={select} />
  );
  const refresh = () => Promise.all([holdings.refetch(), fx.refetch()]);

  if (lots.length === 0) {
    return (
      <Screen onRefresh={refresh}>
        {header}
        {tabs}
        <Empty text={`No holdings in ${portfolio?.name ?? 'this portfolio'} yet. Open any stock and tap + Portfolio.`} />
      </Screen>
    );
  }

  const baseCcy: BaseCurrency = base.data ?? 'USD';
  const other: BaseCurrency = baseCcy === 'USD' ? 'AUD' : 'USD';
  const valuations = positions.flatMap((p) => (quotes[p.symbol] ? [valueHolding(p, quotes[p.symbol].price, quotes[p.symbol].previousClose)] : []));
  const ready = fx.data && valuations.length === positions.length;
  const s = ready ? summarize(valuations, baseCcy, fx.data!) : null;
  const change =
    ready && !periodChanges.loading
      ? sumPeriodChanges(
          valuations.flatMap((v) => {
            const c = periodChanges.changes[v.holding.symbol];
            return c ? [{ currency: v.holding.currency, change: c }] : [];
          }),
          baseCcy,
          fx.data!,
        )
      : null;
  const tone = (v: number) => ({ color: v >= 0 ? theme.up : theme.down });

  return (
    <Screen onRefresh={refresh}>
      {header}
      {tabs}
      <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
        <ThemedText type="small" themeColor="textSecondary">Total value</ThemedText>
        {s ? (
          <>
            <ThemedText type="big">{formatPrice(s.marketValue, baseCcy)}</ThemedText>
            <ThemedText type="caption" themeColor="textSecondary">≈ {formatPrice(convert(s.marketValue, baseCcy, other, fx.data!), other)}</ThemedText>
            <View style={styles.statsRow}>
              <View>
                <ThemedText type="caption" themeColor="textSecondary">{period} change</ThemedText>
                {change ? (
                  <ThemedText type="smallBold" style={tone(change.change)}>
                    {formatSignedPrice(change.change, baseCcy)} ({formatPercent(change.percent)})
                  </ThemedText>
                ) : (
                  <ThemedText type="smallBold" themeColor="textSecondary">…</ThemedText>
                )}
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
        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        <Segmented options={CURRENCIES} value={baseCcy} onChange={(c) => setBase.mutate(c)} />
      </Card>

      {fx.data && <ValueChart lots={lots} base={baseCcy} fx={fx.data} />}

      <AiCard
        title="Today's digest"
        cta={`Write today's ${portfolio?.name ?? 'portfolio'} digest`}
        queryKey={['ai', 'digest', portfolio?.id ?? '', lots.map((l) => `${l.id}:${l.shares}:${l.buyPrice}`).join('|')]}
        fetcher={() => api.portfolioDigest(portfolio?.id)}
      />

      <ThemedText type="heading">Holdings</ThemedText>
      <RowList>
        {valuations.map((v) => {
          const p = v.holding as Position;
          const q = quotes[p.symbol];
          const pc = periodChanges.changes[p.symbol];
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
                {pc && (
                  <ThemedText type="caption" style={[tone(pc.change), { fontWeight: '600' }]}>
                    {period} {formatSignedPrice(pc.change, p.currency)} ({formatPercent(pc.percent)})
                  </ThemedText>
                )}
              </View>
              <ThemedText type="caption" style={tone(v.gain)}>
                Total {formatSignedPrice(v.gain, p.currency)} ({formatPercent(v.gainPercent)})
              </ThemedText>
              {p.lots.map((lot) => (
                <Pressable key={lot.id} onPress={() => setEditing(lot)} accessibilityRole="button" accessibilityHint="Edit or delete this purchase">
                  <ThemedText type="caption" themeColor="textSecondary">
                    · Bought {lot.buyDate}: {formatNumber(lot.shares, lot.shares % 1 ? 4 : 0)} @ {formatPrice(lot.buyPrice, p.currency)}{' '}
                    <ThemedText type="caption" themeColor="accent">Edit</ThemedText>
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          );
        })}
      </RowList>
      <ThemedText type="caption" themeColor="textSecondary">
        Tap a purchase to edit its shares, price or date. Values are in each stock&apos;s own currency.
      </ThemedText>

      {editing && (
        <HoldingSheet
          key={editing.id}
          symbol={editing.symbol}
          currency={editing.currency}
          editing={editing}
          visible
          onClose={() => setEditing(null)}
        />
      )}
    </Screen>
  );
}

/** Portfolio value over time; each purchase counts from its buy date. */
function ValueChart({ lots, base, fx }: { lots: Holding[]; base: BaseCurrency; fx: FxRates }) {
  const [range, setRange] = useState<ChartRange>('6M');
  const histories = useHistories(
    lots.map((l) => l.symbol),
    range,
  );
  const series = histories.data ? portfolioSeries(lots, histories.data, base, fx) : [];
  const candles = series.map((p) => ({ time: p.time, open: p.value, high: p.value, low: p.value, close: p.value }));
  const first = series[0]?.value;
  const last = series[series.length - 1]?.value;

  return (
    <View style={{ gap: Spacing.two }}>
      <View style={styles.chartHeader}>
        <ThemedText type="heading">Value over time</ThemedText>
        {first != null && last != null && first !== 0 && (
          <ThemedText type="caption" themeColor={last >= first ? 'up' : 'down'}>
            {formatSignedPrice(last - first, base)} ({formatPercent(((last - first) / first) * 100)})
          </ThemedText>
        )}
      </View>
      {histories.isPending ? (
        <Skeleton height={200} />
      ) : candles.length < 2 ? (
        <ThemedText type="small" themeColor="textSecondary">Not enough history in this range yet.</ThemedText>
      ) : (
        <AreaChart candles={candles} height={200} />
      )}
      <Segmented options={CHART_RANGES} value={range as (typeof CHART_RANGES)[number]['id']} onChange={setRange} />
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: Spacing.four, flexWrap: 'wrap' },
  holdingTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  holdingBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two, flexWrap: 'wrap' },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: Spacing.two },
});
