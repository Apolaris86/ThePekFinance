import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { RowList } from '@/components/lists';
import { Screen, SymbolChip } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSearch } from '@/lib/queries';

const EXCHANGE = { US: 'US', SGX: 'SGX', EPA: 'Paris' } as const;

export default function SearchScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const { data: results = [], isFetching } = useSearch(query);

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  function open(symbol: string) {
    router.dismiss();
    router.push({ pathname: '/quote/[symbol]', params: { symbol } });
  }

  return (
    <Screen edges={[]}>
      <TextInput
        autoFocus
        value={text}
        onChangeText={setText}
        placeholder="Ticker or company, e.g. DBS, LVMH, AAPL"
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={() => results[0] && open(results[0].symbol)}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
      />
      {query && !isFetching && results.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">No US, SGX or Paris matches for “{query}”.</ThemedText>
      ) : results.length > 0 ? (
        <RowList>
          {results.map((r) => (
            <Pressable key={r.symbol} onPress={() => open(r.symbol)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.backgroundElement }]}>
              <SymbolChip symbol={r.symbol} />
              <ThemedText type="small" numberOfLines={1} style={{ flex: 1 }}>{r.name}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">{EXCHANGE[r.exchange]}</ThemedText>
            </Pressable>
          ))}
        </RowList>
      ) : (
        <View />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: 12, minHeight: 52 },
});
