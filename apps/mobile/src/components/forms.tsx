import { describeAlert, isTriggered, type AlertKind, type Currency, type Holding, type Quote } from '@pek/shared';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Segmented } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useMutations, usePortfolios } from '@/lib/queries';

/** Bottom sheet wrapper shared by the holding and alert forms. */
function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <ThemedText type="heading">{title}</ThemedText>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <ThemedText type="small">{label}</ThemedText>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        {...props}
      />
    </View>
  );
}

// Local calendar date as YYYY-MM-DD (en-CA formats that way).
const today = () => new Date().toLocaleDateString('en-CA');

/**
 * Add a purchase (from a stock screen) or edit one (from the portfolio).
 * Remount with a new `key` when switching between lots so the fields reset.
 */
export function HoldingSheet({
  symbol,
  currency,
  defaultPrice,
  editing,
  portfolioId,
  visible,
  onClose,
}: {
  symbol: string;
  currency: Currency;
  defaultPrice?: number;
  /** existing purchase to edit */
  editing?: Holding;
  /** portfolio to preselect for a new purchase (defaults to the first one) */
  portfolioId?: string;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const portfolios = usePortfolios();
  const { addHolding, updateHolding, deleteHolding } = useMutations();
  const [shares, setShares] = useState(editing ? String(editing.shares) : '');
  const [price, setPrice] = useState(String(editing?.buyPrice ?? defaultPrice ?? ''));
  const [date, setDate] = useState(editing?.buyDate ?? today());
  const [portfolio, setPortfolio] = useState(editing?.portfolioId ?? portfolioId);
  const [error, setError] = useState<string | null>(null);
  const target = portfolio ?? portfolios.data?.[0]?.id;

  async function save() {
    const s = Number(shares);
    const p = Number(price);
    if (!(s > 0)) return setError('Shares must be more than 0');
    if (!(p >= 0)) return setError('Enter the price you paid per share');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) return setError('Use a date like 2026-01-15, not in the future');
    if (!target) return setError('Choose a portfolio');
    const holding = { portfolioId: target, symbol, shares: s, buyPrice: p, buyDate: date, currency };
    try {
      if (editing) await updateHolding.mutateAsync({ id: editing.id, holding });
      else await addHolding.mutateAsync(holding);
      if (!editing) setShares('');
      setError(null);
      onClose();
    } catch {
      setError("Couldn't save. Try again.");
    }
  }

  function confirmDelete() {
    if (!editing) return;
    Alert.alert('Delete this purchase?', `${editing.shares} ${symbol} bought ${editing.buyDate}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHolding.mutate(editing.id, { onSuccess: onClose }) },
    ]);
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? `Edit ${symbol} purchase` : `Add ${symbol} to portfolio`}>
      {!!portfolios.data?.length && target && (
        <Segmented options={portfolios.data.map((p) => ({ id: p.id, label: p.name }))} value={target} onChange={setPortfolio} />
      )}
      <View style={{ flexDirection: 'row', gap: Spacing.three }}>
        <Field label="Shares" value={shares} onChangeText={setShares} keyboardType="decimal-pad" placeholder="10" autoFocus={!editing} />
        <Field label={`Price paid (${currency})`} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
      </View>
      <Field label="Buy date (YYYY-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" />
      {error && <ThemedText type="small" style={{ color: theme.down }}>{error}</ThemedText>}
      <Button title="Save" variant="primary" onPress={save} loading={addHolding.isPending || updateHolding.isPending} />
      {editing && <Button title="Delete purchase" variant="ghost" onPress={confirmDelete} loading={deleteHolding.isPending} />}
    </Sheet>
  );
}

const KINDS = [
  { id: 'above', label: 'Rises to' },
  { id: 'below', label: 'Falls to' },
  { id: 'move', label: 'Moves %' },
] as const;

export function AlertSheet({ quote, visible, onClose }: { quote: Quote; visible: boolean; onClose: () => void }) {
  const theme = useTheme();
  const { createAlert } = useMutations();
  const [kind, setKind] = useState<AlertKind>('above');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const n = Number(value);
  const rule = { symbol: quote.symbol, kind, threshold: n };
  const metNow = n > 0 && kind !== 'move' && isTriggered(rule, { price: quote.price, changePercent: quote.changePercent });

  async function save() {
    if (!(n > 0)) return setError(kind === 'move' ? 'Enter a percentage above 0' : 'Enter a price above 0');
    try {
      await createAlert.mutateAsync(rule);
      setValue('');
      setError(null);
      onClose();
    } catch {
      setError("Couldn't save the alert. Try again.");
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title={`Alert for ${quote.symbol}`}>
      <Segmented options={KINDS} value={kind} onChange={setKind} />
      <Field
        label={kind === 'move' ? 'Percent move (up or down)' : `Price (${quote.currency})`}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder={kind === 'move' ? '5' : String(quote.price)}
        autoFocus
      />
      {n > 0 && <ThemedText type="small">{describeAlert(rule, quote.currency)}</ThemedText>}
      {metNow && <ThemedText type="caption" style={{ color: theme.down }}>Already met, so it fires on the next check.</ThemedText>}
      <ThemedText type="caption" themeColor="textSecondary">Checked every minute on weekdays. You&apos;ll get a notification and an email, then the alert pauses.</ThemedText>
      {error && <ThemedText type="small" style={{ color: theme.down }}>{error}</ThemedText>}
      <Button title="Create alert" variant="primary" onPress={save} loading={createAlert.isPending} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, fontVariant: ['tabular-nums'] },
});
