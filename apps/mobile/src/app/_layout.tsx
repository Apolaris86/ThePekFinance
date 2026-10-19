import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  const scheme = useColorScheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: (count, err) => count < 2 && !('status' in err && (err.status === 404 || err.status === 400 || err.status === 401)),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="quote/[symbol]" options={{ title: '' }} />
            <Stack.Screen name="search" options={{ presentation: 'modal', title: 'Search' }} />
            <Stack.Screen name="login" options={{ presentation: 'modal', title: 'Sign in' }} />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
