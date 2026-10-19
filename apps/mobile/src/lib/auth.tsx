import type { User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState } from 'react';

import { supabase } from './supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    if (!supabase) return 'Supabase is not configured';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signOut() {
    await supabase?.auth.signOut();
    queryClient.removeQueries({ queryKey: ['db'] });
  }

  return <AuthContext value={{ user, loading, signIn, signOut }}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
