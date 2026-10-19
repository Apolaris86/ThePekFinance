import { describeAlert, formatPercent, formatPrice, isTriggered, type Alert as PriceAlert } from '@pek/shared';
import { Alert, Pressable, View } from 'react-native';

import { RowList } from '@/components/lists';
import { ThemedText } from '@/components/themed-text';
import { Empty, Screen, SignInPrompt, Skeleton, SymbolChip } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { useAlertEvents, useAlerts, useMutations, useQuote } from '@/lib/queries';

export default function AlertsScreen() {
  const { user } = useAuth();
  const alerts = useAlerts();
  const events = useAlertEvents();

  return (
    <Screen onRefresh={() => Promise.all([alerts.refetch(), events.refetch()])}>
      <ThemedText type="title">Alerts</ThemedText>
      {!user ? (
        <SignInPrompt what="price alerts" />
      ) : alerts.isPending ? (
        <Skeleton height={160} />
      ) : !alerts.data?.length ? (
        <Empty text="No alerts yet. Open a stock and tap Alert. You'll get an email when it fires." />
      ) : (
        <>
          <ThemedText type="caption" themeColor="textSecondary">
            Emails go to {user.email}. Checked every minute, Monday to Friday. Alerts fire once, then pause.
          </ThemedText>
          <RowList>
            {alerts.data.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </RowList>
        </>
      )}

      {!!events.data?.length && (
        <View style={{ gap: Spacing.two }}>
          <ThemedText type="heading">History</ThemedText>
          <RowList>
            {events.data.map((e) => (
              <View key={e.id} style={{ padding: Spacing.three, gap: 2 }}>
                <ThemedText type="small">{describeAlert(e, e.currency ?? undefined)}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  at {e.price} {e.currency} · {new Date(e.triggeredAt).toLocaleString()} {e.emailed ? '· emailed' : ''}
                </ThemedText>
              </View>
            ))}
          </RowList>
        </View>
      )}
    </Screen>
  );
}

function AlertRow({ alert: a }: { alert: PriceAlert }) {
  const { data: q } = useQuote(a.symbol);
  const { setAlertActive, deleteAlert } = useMutations();
  const metNow = !!q && isTriggered(a, { price: q.price, changePercent: q.changePercent, marketState: q.marketState });

  function actions() {
    Alert.alert(describeAlert(a, q?.currency), undefined, [
      { text: a.active ? 'Pause' : 'Re-arm', onPress: () => setAlertActive.mutate({ id: a.id, active: !a.active }) },
      { text: 'Delete', style: 'destructive', onPress: () => deleteAlert.mutate(a.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <Pressable onPress={actions} style={{ padding: Spacing.three, gap: 4, opacity: a.active ? 1 : 0.6 }} accessibilityRole="button" accessibilityHint="Opens pause, re-arm and delete options">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <SymbolChip symbol={a.symbol} />
        <ThemedText type="caption" themeColor={a.active ? 'up' : 'textSecondary'}>{a.active ? 'Active' : 'Paused'}</ThemedText>
      </View>
      <ThemedText type="small">{describeAlert(a, q?.currency)}</ThemedText>
      {q && (
        <ThemedText type="caption" themeColor="textSecondary">
          Now {formatPrice(q.price, q.currency)} ({formatPercent(q.changePercent)} today)
          {a.active && metNow ? ' · condition met, fires on the next check' : ''}
          {a.triggeredAt ? ` · fired ${new Date(a.triggeredAt).toLocaleString()}` : ''}
        </ThemedText>
      )}
    </Pressable>
  );
}
