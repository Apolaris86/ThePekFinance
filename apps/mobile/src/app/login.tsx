import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Screen } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';

export default function LoginScreen() {
  const theme = useTheme();
  const { user, signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!supabaseConfigured) {
    return (
      <Screen edges={[]}>
        <ThemedText style={{ color: theme.down }}>Supabase isn&apos;t configured. Add the EXPO_PUBLIC_ keys to apps/mobile/.env.local.</ThemedText>
      </Screen>
    );
  }

  if (user) {
    return (
      <Screen edges={[]}>
        <ThemedText>Signed in as {user.email}</ThemedText>
        <Button title="Sign out" onPress={async () => { await signOut(); router.back(); }} />
      </Screen>
    );
  }

  async function submit() {
    setBusy(true);
    const err = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err);
    else router.back();
  }

  const input = [styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement }];
  return (
    <Screen edges={[]}>
      <ThemedText type="small" themeColor="textSecondary">Use the same account as the web app.</ThemedText>
      <View style={{ gap: Spacing.three }}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          style={input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.textSecondary}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
          style={input}
        />
        {error && <ThemedText type="small" style={{ color: theme.down }}>{error}</ThemedText>}
        <Button title="Sign in" variant="primary" onPress={submit} loading={busy} disabled={!email || !password} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.three, paddingVertical: 12, fontSize: 16 },
});
