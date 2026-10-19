"use client";

import {
  addHolding,
  createAlert,
  deleteAlert,
  listAlertEvents,
  listAlerts,
  setAlertActive,
  type AlertRule,
  addToWatchlist,
  createWatchlist,
  deleteHolding,
  deleteWatchlist,
  getBaseCurrency,
  listHoldings,
  listWatchlists,
  removeFromWatchlist,
  renameWatchlist,
  reorderWatchlist,
  setBaseCurrency,
  updateHolding,
  type Currency,
  type NewHolding,
  type WatchlistItem,
} from "@pek/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { api } from "./queries";
import { getSupabase } from "./supabase";

// All user data lives under the ["db", userId] key so sign-out can drop it in one go.

function useUserKey() {
  const { user } = useAuth();
  return { userId: user?.id, key: ["db", user?.id ?? "anon"] as const };
}

export function useWatchlists() {
  const { userId, key } = useUserKey();
  return useQuery({ queryKey: [...key, "watchlists"], queryFn: () => listWatchlists(getSupabase()), enabled: !!userId });
}

export function useHoldings() {
  const { userId, key } = useUserKey();
  return useQuery({ queryKey: [...key, "holdings"], queryFn: () => listHoldings(getSupabase()), enabled: !!userId });
}

export function useBaseCurrency() {
  const { userId, key } = useUserKey();
  return useQuery({ queryKey: [...key, "base"], queryFn: () => getBaseCurrency(getSupabase()), enabled: !!userId });
}

export const useFx = () => useQuery({ queryKey: ["fx"], queryFn: api.fx, staleTime: 5 * 60_000 });

type Slice = "watchlists" | "holdings" | "base" | "alerts" | "alertEvents";

/** Mutation that refetches the given slices of user data when it settles. */
function useDbMutation<V>(slice: Slice | Slice[], fn: (vars: V) => Promise<unknown>) {
  const { key } = useUserKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([slice].flat().map((s) => qc.invalidateQueries({ queryKey: [...key, s] }))),
  });
}

export function useWatchlistMutations() {
  const sb = getSupabase;
  return {
    create: useDbMutation("watchlists", (v: { name: string; position: number }) => createWatchlist(sb(), v.name, v.position)),
    rename: useDbMutation("watchlists", (v: { id: string; name: string }) => renameWatchlist(sb(), v.id, v.name)),
    remove: useDbMutation("watchlists", (id: string) => deleteWatchlist(sb(), id)),
    addItem: useDbMutation("watchlists", (v: { watchlistId: string; symbol: string; position: number }) =>
      addToWatchlist(sb(), v.watchlistId, v.symbol, v.position),
    ),
    removeItem: useDbMutation("watchlists", (itemId: string) => removeFromWatchlist(sb(), itemId)),
    reorder: useDbMutation("watchlists", (items: WatchlistItem[]) => reorderWatchlist(sb(), items)),
  };
}

export function useHoldingMutations() {
  const sb = getSupabase;
  return {
    add: useDbMutation("holdings", (h: NewHolding) => addHolding(sb(), h)),
    update: useDbMutation("holdings", (v: { id: string; holding: NewHolding }) => updateHolding(sb(), v.id, v.holding)),
    remove: useDbMutation("holdings", (id: string) => deleteHolding(sb(), id)),
  };
}

export function useSetBaseCurrency() {
  const { userId } = useUserKey();
  return useDbMutation("base", (c: Currency) => setBaseCurrency(getSupabase(), userId!, c));
}

export function useAlerts() {
  const { userId, key } = useUserKey();
  return useQuery({ queryKey: [...key, "alerts"], queryFn: () => listAlerts(getSupabase()), enabled: !!userId, refetchInterval: 60_000 });
}

export function useAlertEvents() {
  const { userId, key } = useUserKey();
  return useQuery({ queryKey: [...key, "alertEvents"], queryFn: () => listAlertEvents(getSupabase()), enabled: !!userId, refetchInterval: 60_000 });
}

export function useAlertMutations() {
  const sb = getSupabase;
  return {
    create: useDbMutation("alerts", (rule: AlertRule) => createAlert(sb(), rule)),
    setActive: useDbMutation("alerts", (v: { id: string; active: boolean }) => setAlertActive(sb(), v.id, v.active)),
    remove: useDbMutation(["alerts", "alertEvents"], (id: string) => deleteAlert(sb(), id)),
  };
}
