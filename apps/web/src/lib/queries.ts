"use client";

import { createApiClient, exchangeOf, pollInterval, type ChartRange, type Exchange } from "@pek/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLiveSymbols } from "./live";
import { getSupabase, supabaseConfigured } from "./supabase";

export const api = createApiClient("", async () =>
  supabaseConfigured ? (await getSupabase().auth.getSession()).data.session?.access_token : undefined,
);

/** refetchInterval for a market: reads the clock only in the browser, never while prerendering. */
export const marketPoll = (exchange: Exchange, factor = 1) => () =>
  typeof window === "undefined" ? false : pollInterval(exchange) * factor;

/** Quote that polls on a market-hours cadence and streams trades for US symbols when signed in. */
export function useQuote(symbol: string) {
  useLiveSymbols([symbol]);
  return useQuery({
    queryKey: ["quote", symbol],
    queryFn: () => api.quote(symbol),
    refetchInterval: marketPoll(exchangeOf(symbol)),
  });
}

export const useHistory = (symbol: string, range: ChartRange) =>
  useQuery({
    queryKey: ["history", symbol, range],
    queryFn: () => api.history(symbol, range),
    placeholderData: keepPreviousData,
    refetchInterval: range === "1D" ? 60_000 : false,
  });

export const useProfile = (symbol: string) =>
  useQuery({ queryKey: ["profile", symbol], queryFn: () => api.profile(symbol), staleTime: Infinity });

export const useNews = (symbol?: string) =>
  useQuery({ queryKey: ["news", symbol ?? ""], queryFn: () => api.news(symbol), staleTime: 5 * 60_000 });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ["search", q.toLowerCase()],
    queryFn: () => api.search(q),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60 * 60_000,
  });
