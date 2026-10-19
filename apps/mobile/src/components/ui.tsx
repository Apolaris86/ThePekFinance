import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Scrollable page with safe-area padding and pull-to-refresh. */
export function Screen({
  children,
  onRefresh,
  edges = ['top'],
}: {
  children: React.ReactNode;
  onRefresh?: () => Promise<unknown>;
  edges?: ('top' | 'bottom')[];
}) {
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              tintColor={theme.textSecondary}
              onRefresh={async () => {
                setRefreshing(true);
                await onRefresh().catch(() => {});
                setRefreshing(false);
              }}
            />
          ) : undefined
        }>
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ style, ...props }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.background }, style]} {...props} />;
}

export function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing.two }}>
      <View style={styles.sectionHeader}>
        <ThemedText type="heading">{title}</ThemedText>
        {action}
      </View>
      {children}
    </View>
  );
}

export function SymbolChip({ symbol }: { symbol: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="mono" themeColor="accent" numberOfLines={1}>
        {symbol}
      </ThemedText>
    </View>
  );
}

export function ChangePill({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  const up = value >= 0;
  return (
    <View style={[styles.pill, { backgroundColor: up ? theme.upBg : theme.downBg }]}>
      <ThemedText type="smallBold" style={{ color: up ? theme.up : theme.down, fontVariant: ['tabular-nums'] }}>
        {label}
      </ThemedText>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'secondary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.accent : 'transparent';
  const fg = variant === 'primary' ? theme.onAccent : theme.accent;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? theme.border : 'transparent' },
        (pressed || disabled) && { opacity: 0.6 },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <ThemedText type="smallBold" style={{ color: fg }}>{title}</ThemedText>}
    </Pressable>
  );
}

/** Horizontal pill tabs (chart ranges, markets, list switchers). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.id)}
            style={[
              styles.segment,
              { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? theme.backgroundSelected : 'transparent' },
            ]}>
            <ThemedText type="smallBold" themeColor={active ? 'accent' : 'textSecondary'}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.empty, { borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
        {text}
      </ThemedText>
      {action}
    </View>
  );
}

export function Skeleton({ height = 48 }: { height?: number }) {
  const theme = useTheme();
  return <View style={{ height, borderRadius: Radius.md, backgroundColor: theme.backgroundElement }} />;
}

/** Fake search input that opens the search screen. */
export function SearchBar() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="search"
      onPress={() => router.push('/search')}
      style={[styles.search, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary">
        Search stocks, ETFs & indices
      </ThemedText>
    </Pressable>
  );
}

export function SignInPrompt({ what }: { what: string }) {
  return (
    <Empty
      text={`Sign in to see your ${what}.`}
      action={<Button title="Sign in" variant="primary" onPress={() => router.push('/login')} />}
    />
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.six },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: Spacing.four },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.lg, overflow: 'hidden' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2, minWidth: 64, alignItems: 'center' },
  pill: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 2 },
  button: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  segment: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  search: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: 12 },
});
