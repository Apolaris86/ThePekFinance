"use client";

import { exchangeOf, type Quote } from "@pek/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "./auth";
import { getSupabase } from "./supabase";

// One Finnhub WebSocket per tab. Components subscribe symbols (ref-counted);
// trades are coalesced and written into the React Query quote cache once a
// second, so every component reading ["quote", symbol] updates live.

export type LiveStatus = "off" | "connecting" | "live" | "unavailable";

const MAX_SYMBOLS = 50; // Finnhub free tier limit per connection
const FLUSH_MS = 1000;

/** Only US stocks/ETFs stream on Finnhub's free tier; indices don't. */
export const isLiveEligible = (symbol: string) => exchangeOf(symbol) === "US" && !symbol.startsWith("^");

class LiveFeed {
  private ws: WebSocket | null = null;
  private refs = new Map<string, number>();
  private pending = new Map<string, { price: number; time: number }>();
  private status: LiveStatus = "off";
  private statusListeners = new Set<() => void>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private retry = 0;
  private stopped = true;
  queryClient: QueryClient | null = null;

  getStatus = () => this.status;
  onStatus = (fn: () => void) => {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  };

  private setStatus(s: LiveStatus) {
    this.status = s;
    this.statusListeners.forEach((fn) => fn());
  }

  subscribe(symbol: string) {
    const n = this.refs.get(symbol) ?? 0;
    if (n === 0 && this.refs.size >= MAX_SYMBOLS) return;
    this.refs.set(symbol, n + 1);
    if (n === 0) this.send({ type: "subscribe", symbol });
    if (this.stopped && this.status !== "unavailable") void this.start();
  }

  unsubscribe(symbol: string) {
    const n = this.refs.get(symbol) ?? 0;
    if (n <= 1) {
      this.refs.delete(symbol);
      this.send({ type: "unsubscribe", symbol });
    } else this.refs.set(symbol, n - 1);
  }

  stop() {
    this.stopped = true;
    this.ws?.close();
    this.ws = null;
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flushTimer = null;
    this.setStatus("off");
  }

  private send(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private async start() {
    this.stopped = false;
    this.setStatus("connecting");
    const { data } = await getSupabase().auth.getSession();
    const jwt = data.session?.access_token;
    const res = jwt ? await fetch("/api/live-token", { headers: { Authorization: `Bearer ${jwt}` } }) : null;
    if (!res?.ok) {
      // No key configured or not signed in: stay on polling.
      this.stopped = true;
      this.setStatus("unavailable");
      return;
    }
    const { token } = (await res.json()) as { token: string };
    this.connect(token);
    this.flushTimer ??= setInterval(() => this.flush(), FLUSH_MS);
  }

  private connect(token: string) {
    if (this.stopped) return;
    const ws = new WebSocket(`wss://ws.finnhub.io?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.setStatus("live");
      for (const symbol of this.refs.keys()) this.send({ type: "subscribe", symbol });
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as { type: string; data?: { s: string; p: number; t: number }[] };
      if (msg.type !== "trade" || !msg.data) return;
      for (const t of msg.data) {
        const prev = this.pending.get(t.s);
        if (!prev || t.t >= prev.time) this.pending.set(t.s, { price: t.p, time: t.t });
      }
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.stopped) return;
      this.setStatus("connecting");
      const delay = Math.min(30_000, 1000 * 2 ** this.retry++);
      setTimeout(() => this.connect(token), delay);
    };
  }

  private flush() {
    if (!this.queryClient || this.pending.size === 0) return;
    for (const [symbol, { price, time }] of this.pending) {
      this.queryClient.setQueryData<Quote>(["quote", symbol], (old) =>
        old
          ? {
              ...old,
              price,
              change: price - old.previousClose,
              changePercent: old.previousClose ? ((price - old.previousClose) / old.previousClose) * 100 : 0,
              timestamp: time,
              delayed: false,
            }
          : old,
      );
    }
    this.pending.clear();
  }
}

const feed = new LiveFeed();

/** Stream prices for these symbols while mounted (US only; others keep polling). */
export function useLiveSymbols(symbols: string[]) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const key = symbols.filter(isLiveEligible).sort().join(",");

  useEffect(() => {
    if (!user || !key) return;
    feed.queryClient = queryClient;
    const list = key.split(",");
    list.forEach((s) => feed.subscribe(s));
    return () => list.forEach((s) => feed.unsubscribe(s));
  }, [key, user, queryClient]);

  useEffect(() => {
    if (!user) feed.stop();
  }, [user]);
}

export function useLiveStatus(): LiveStatus {
  return useSyncExternalStore(feed.onStatus, feed.getStatus, () => "off");
}
