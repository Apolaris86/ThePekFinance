import type { Sentiment } from '@pek/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card, Skeleton } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

export interface AiResult {
  headline: string;
  points: string[];
  watch?: string[];
  sentiment?: Sentiment;
  generatedAt: number;
}

/** On-demand Claude summary; nothing is requested until the user taps the button. */
export function AiCard({ title, cta, queryKey, fetcher }: { title: string; cta: string; queryKey: readonly unknown[]; fetcher: () => Promise<AiResult> }) {
  const theme = useTheme();
  const { user } = useAuth();
  const [requested, setRequested] = useState(false);
  const { data, error, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: fetcher,
    enabled: requested && !!user,
    staleTime: 60 * 60_000,
    retry: false,
  });
  if (!user) return null;

  return (
    <Card style={{ padding: Spacing.three, gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <ThemedText type="subheading">
          <ThemedText type="subheading" themeColor="accent">✦ </ThemedText>
          {title}
        </ThemedText>
        {data?.sentiment && (
          <ThemedText type="caption" themeColor="textSecondary" style={{ textTransform: 'capitalize' }}>
            {data.sentiment}
          </ThemedText>
        )}
      </View>
      {!requested ? (
        <Button title={cta} onPress={() => setRequested(true)} />
      ) : isFetching && !data ? (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="small" themeColor="textSecondary">Reading the latest numbers and headlines…</ThemedText>
          <Skeleton height={16} />
          <Skeleton height={16} />
          <Skeleton height={16} />
        </View>
      ) : error ? (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="small" style={{ color: theme.down }}>{error.message}</ThemedText>
          <Button title="Try again" variant="ghost" onPress={() => refetch()} />
        </View>
      ) : data ? (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="smallBold">{data.headline}</ThemedText>
          {data.points.map((p, i) => (
            <ThemedText key={i} type="small">• {p}</ThemedText>
          ))}
          {!!data.watch?.length && (
            <>
              <ThemedText type="caption" themeColor="textSecondary" style={{ marginTop: Spacing.two }}>WORTH WATCHING</ThemedText>
              {data.watch.map((w, i) => (
                <ThemedText key={i} type="small" themeColor="textSecondary">• {w}</ThemedText>
              ))}
            </>
          )}
          <ThemedText type="caption" themeColor="textSecondary">
            Written by Claude from current prices and headlines. It can make mistakes and isn&apos;t financial advice.
          </ThemedText>
        </View>
      ) : null}
    </Card>
  );
}
