"use client";

import { createApiClient, type ChartRange } from "@pek/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const api = createApiClient("");

export const useQuote = (symbol: string) =>
  useQuery({ queryKey: ["quote", symbol], queryFn: () => api.quote(symbol), refetchInterval: 30_000 });

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
