import {
  addHolding,
  addToWatchlist,
  createAlert,
  createApiClient,
  deleteAlert,
  deleteHolding,
  exchangeOf,
  getBaseCurrency,
  listAlertEvents,
  listAlerts,
  listHoldings,
  listWatchlists,
  pollInterval,
  removeFromWatchlist,
  setAlertActive,
  setBaseCurrency,
  type AlertRule,
  type ChartRange,
  type Currency,
  type Exchange,
  type NewHolding,
} from '@pek/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from './auth';
import { getSupabase, supabase } from './supabase';

// The mobile app talks to the same Next.js API as the web app. In development
// that's your computer's LAN address (a phone can't reach "localhost").
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export const api = createApiClient(API_URL, async () => (await supabase?.auth.getSession())?.data.session?.access_token);

const marketPoll = (exchange: Exchange, factor = 1) => () => pollInterval(exchange) * factor;

// --- Market data -----------------------------------------------------------

export const useQuote = (symbol: string, enabled = true) =>
  useQuery({
    queryKey: ['quote', symbol],
    queryFn: () => api.quote(symbol),
    enabled: enabled && !!symbol,
    refetchInterval: marketPoll(exchangeOf(symbol)),
  });

export const useQuotes = (symbols: string[]) =>
  useQuery({
    queryKey: ['quotes', [...symbols].sort().join(',')],
    queryFn: () => api.quotes(symbols),
    enabled: symbols.length > 0,
    refetchInterval: marketPoll('US'),
  });

export const useHistory = (symbol: string, range: ChartRange) =>
  useQuery({
    queryKey: ['history', symbol, range],
    queryFn: () => api.history(symbol, range),
    placeholderData: keepPreviousData,
    staleTime: range === '1D' ? 60_000 : 60 * 60_000,
  });

export const useProfile = (symbol: string) =>
  useQuery({ queryKey: ['profile', symbol], queryFn: () => api.profile(symbol), staleTime: Infinity });

export const useNews = (symbol?: string) =>
  useQuery({ queryKey: ['news', symbol ?? ''], queryFn: () => api.news(symbol), staleTime: 5 * 60_000 });

export const useMovers = (market: Exchange) =>
  useQuery({ queryKey: ['movers', market], queryFn: () => api.movers(market), refetchInterval: marketPoll(market, 2) });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ['search', q.toLowerCase()],
    queryFn: () => api.search(q),
    enabled: q.trim().length > 0,
    placeholderData: keepPreviousData,
  });

export const useFx = () => useQuery({ queryKey: ['fx'], queryFn: api.fx, staleTime: 5 * 60_000 });

// --- User data (RLS-scoped via the signed-in Supabase session) --------------

type Slice = 'watchlists' | 'holdings' | 'base' | 'alerts' | 'alertEvents';

function useUserKey() {
  const { user } = useAuth();
  return { userId: user?.id, key: ['db', user?.id ?? 'anon'] as const };
}

function useUserQuery<T>(slice: Slice, fn: () => Promise<T>) {
  const { userId, key } = useUserKey();
  return useQuery({ queryKey: [...key, slice], queryFn: fn, enabled: !!userId });
}

function useDbMutation<V>(slices: Slice[], fn: (vars: V) => Promise<unknown>) {
  const { key } = useUserKey();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all(slices.map((s) => qc.invalidateQueries({ queryKey: [...key, s] }))),
  });
}

export const useWatchlists = () => useUserQuery('watchlists', () => listWatchlists(getSupabase()));
export const useHoldings = () => useUserQuery('holdings', () => listHoldings(getSupabase()));
export const useBaseCurrency = () => useUserQuery('base', () => getBaseCurrency(getSupabase()));
export const useAlerts = () => useUserQuery('alerts', () => listAlerts(getSupabase()));
export const useAlertEvents = () => useUserQuery('alertEvents', () => listAlertEvents(getSupabase()));

export function useMutations() {
  const { userId } = useUserKey();
  const sb = getSupabase;
  return {
    follow: useDbMutation(['watchlists'], (v: { watchlistId: string; symbol: string; position: number }) =>
      addToWatchlist(sb(), v.watchlistId, v.symbol, v.position),
    ),
    unfollow: useDbMutation(['watchlists'], (itemId: string) => removeFromWatchlist(sb(), itemId)),
    addHolding: useDbMutation(['holdings'], (h: NewHolding) => addHolding(sb(), h)),
    deleteHolding: useDbMutation(['holdings'], (id: string) => deleteHolding(sb(), id)),
    setBase: useDbMutation(['base'], (c: Currency) => setBaseCurrency(sb(), userId!, c)),
    createAlert: useDbMutation(['alerts'], (rule: AlertRule) => createAlert(sb(), rule)),
    setAlertActive: useDbMutation(['alerts'], (v: { id: string; active: boolean }) => setAlertActive(sb(), v.id, v.active)),
    deleteAlert: useDbMutation(['alerts', 'alertEvents'], (id: string) => deleteAlert(sb(), id)),
  };
}
