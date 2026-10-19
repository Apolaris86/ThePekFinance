import 'expo-sqlite/localStorage/install';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

/** Session persists via expo-sqlite's localStorage (see Expo's Supabase guide). */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

export function getSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return supabase;
}

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (!supabase) return;
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
