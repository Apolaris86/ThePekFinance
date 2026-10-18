"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Sentiment } from "@pek/shared";
import { useAuth } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";

export interface AiResult {
  headline: string;
  points: string[];
  watch?: string[];
  sentiment?: Sentiment;
  generatedAt: number;
}

interface Props {
  title: string;
  cta: string;
  queryKey: readonly unknown[];
  fetcher: () => Promise<AiResult>;
}

const SENTIMENT: Record<Sentiment, string> = {
  positive: "bg-up-bg text-up",
  negative: "bg-down-bg text-down",
  mixed: "bg-surface text-foreground",
  neutral: "bg-surface text-muted",
};

/** On-demand Claude summary. Nothing is requested until the user asks. */
export function AiCard({ title, cta, queryKey, fetcher }: Props) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [requested, setRequested] = useState(false);
  const { data, error, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: fetcher,
    enabled: requested && !!user,
    staleTime: 60 * 60_000,
    retry: false,
  });

  if (!supabaseConfigured) return null;

  return (
    <section className="rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <span aria-hidden className="text-accent">✦</span> {title}
        </h2>
        {data?.sentiment && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${SENTIMENT[data.sentiment]}`}>{data.sentiment}</span>
        )}
      </div>

      {!user ? (
        <p className="mt-3 text-sm text-muted">
          <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="text-accent hover:underline">Sign in</Link> to use AI summaries.
        </p>
      ) : !requested ? (
        <button
          onClick={() => setRequested(true)}
          className="mt-3 rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/20"
        >
          {cta}
        </button>
      ) : isFetching && !data ? (
        <div className="mt-4 space-y-2" aria-live="polite">
          <p className="text-sm text-muted">Reading the latest numbers and headlines…</p>
          <div className="h-4 w-3/4 animate-pulse rounded bg-surface" />
          <div className="h-4 w-full animate-pulse rounded bg-surface" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-surface" />
        </div>
      ) : error ? (
        <div className="mt-3 text-sm">
          <p className="text-down">{error.message}</p>
          <button onClick={() => refetch()} className="mt-2 text-accent hover:underline">Try again</button>
        </div>
      ) : data ? (
        <div className="mt-3 text-sm leading-relaxed">
          <p className="font-medium">{data.headline}</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            {data.points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          {!!data.watch?.length && (
            <>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Worth watching</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                {data.watch.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-4 text-xs text-muted">
            Written by Claude from current prices and headlines at{" "}
            {new Date(data.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. It can make mistakes and
            isn&apos;t financial advice.
          </p>
        </div>
      ) : null}
    </section>
  );
}
