"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";

/** Only allow same-site relative redirects. */
function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/portfolio";
}

export function LoginForm() {
  const { user, signIn } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(await signIn(String(form.get("email")), String(form.get("password"))));
    setBusy(false);
  }

  if (!supabaseConfigured) {
    return <p className="mt-6 text-sm text-down">Supabase isn&apos;t configured yet. Add the keys to apps/web/.env.local.</p>;
  }

  const input =
    "mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-accent focus:bg-background";
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        Email
        <input name="email" type="email" required autoComplete="email" className={input} />
      </label>
      <label className="block text-sm">
        Password
        <input name="password" type="password" required autoComplete="current-password" className={input} />
      </label>
      {error && <p role="alert" className="text-sm text-down">{error}</p>}
      <button
        disabled={busy}
        className="h-11 w-full rounded-full bg-accent text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
