"use client";

import type { User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "./supabase";

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = sb.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    queryClient.removeQueries({ queryKey: ["db"] });
  }

  return <AuthContext value={{ user, loading, signIn, signOut }}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Renders children only for a signed-in user; otherwise sends them to /login. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (supabaseConfigured && !loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  if (!supabaseConfigured) return <NotConfigured />;
  if (loading || !user) return <div className="h-64 animate-pulse rounded-xl bg-surface" />;
  return children;
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border p-6 text-sm">
      <h1 className="text-lg font-medium">Supabase isn&apos;t connected yet</h1>
      <p className="mt-2 text-muted">
        Add <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="font-mono">apps/web/.env.local</code>, then restart the dev server.
      </p>
      <Link href="/" className="mt-4 inline-block text-accent hover:underline">Back to markets</Link>
    </div>
  );
}
