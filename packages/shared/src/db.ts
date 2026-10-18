import type { SupabaseClient } from "@supabase/supabase-js";
import type { Currency, Holding } from "./types";

// Data access for user-owned tables. Row level security scopes every query
// to the signed-in user, so these never filter by user_id themselves.

export interface Watchlist {
  id: string;
  name: string;
  position: number;
  items: WatchlistItem[];
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  position: number;
}

export interface NewHolding {
  symbol: string;
  shares: number;
  buyPrice: number;
  buyDate: string;
  currency: Currency;
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

// --- Profile ---------------------------------------------------------------

export async function getBaseCurrency(sb: SupabaseClient): Promise<Currency> {
  const { data, error } = await sb.from("profiles").select("base_currency").maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.base_currency as Currency | undefined) ?? "USD";
}

export async function setBaseCurrency(sb: SupabaseClient, userId: string, currency: Currency) {
  check(await sb.from("profiles").upsert({ id: userId, base_currency: currency }));
}

// --- Watchlists ------------------------------------------------------------

export async function listWatchlists(sb: SupabaseClient): Promise<Watchlist[]> {
  const rows = check(
    await sb
      .from("watchlists")
      .select("id, name, position, created_at, watchlist_items(id, symbol, position, created_at)")
      .order("position")
      .order("created_at"),
  );
  return rows.map((w) => ({
    id: w.id,
    name: w.name,
    position: w.position,
    items: [...w.watchlist_items]
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      .map(({ id, symbol, position }) => ({ id, symbol, position })),
  }));
}

export async function createWatchlist(sb: SupabaseClient, name: string, position: number) {
  return check(await sb.from("watchlists").insert({ name, position }).select("id").single()).id as string;
}

export async function renameWatchlist(sb: SupabaseClient, id: string, name: string) {
  check(await sb.from("watchlists").update({ name }).eq("id", id));
}

export async function deleteWatchlist(sb: SupabaseClient, id: string) {
  check(await sb.from("watchlists").delete().eq("id", id));
}

export async function addToWatchlist(sb: SupabaseClient, watchlistId: string, symbol: string, position: number) {
  const { error } = await sb.from("watchlist_items").insert({ watchlist_id: watchlistId, symbol, position });
  // 23505 = already in this list, which is fine
  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function removeFromWatchlist(sb: SupabaseClient, itemId: string) {
  check(await sb.from("watchlist_items").delete().eq("id", itemId));
}

/** Persist a new order: items[i] gets position i. */
export async function reorderWatchlist(sb: SupabaseClient, items: WatchlistItem[]) {
  await Promise.all(
    items.map(async (item, i) => check(await sb.from("watchlist_items").update({ position: i }).eq("id", item.id))),
  );
}

// --- Holdings --------------------------------------------------------------

interface HoldingRow {
  id: string;
  symbol: string;
  shares: number | string;
  buy_price: number | string;
  buy_date: string;
  currency: Currency;
}

const toHolding = (r: HoldingRow): Holding => ({
  id: r.id,
  symbol: r.symbol,
  shares: Number(r.shares),
  buyPrice: Number(r.buy_price),
  buyDate: r.buy_date,
  currency: r.currency,
});

export async function listHoldings(sb: SupabaseClient): Promise<Holding[]> {
  const rows = check(
    await sb.from("holdings").select("id, symbol, shares, buy_price, buy_date, currency").order("buy_date"),
  );
  return (rows as HoldingRow[]).map(toHolding);
}

export async function addHolding(sb: SupabaseClient, h: NewHolding) {
  check(
    await sb.from("holdings").insert({
      symbol: h.symbol,
      shares: h.shares,
      buy_price: h.buyPrice,
      buy_date: h.buyDate,
      currency: h.currency,
    }),
  );
}

export async function updateHolding(sb: SupabaseClient, id: string, h: NewHolding) {
  check(
    await sb
      .from("holdings")
      .update({ symbol: h.symbol, shares: h.shares, buy_price: h.buyPrice, buy_date: h.buyDate, currency: h.currency })
      .eq("id", id),
  );
}

export async function deleteHolding(sb: SupabaseClient, id: string) {
  check(await sb.from("holdings").delete().eq("id", id));
}
