// Web build (Expo web preview): the browser's own localStorage holds the session,
// so the native expo-sqlite storage shim (which needs WebAssembly setup) isn't loaded.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null =
  supabaseConfigured && typeof window !== 'undefined'
    ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
    : null;

export function getSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured: set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return supabase;
}
