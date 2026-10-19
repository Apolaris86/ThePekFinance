import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertKind, AlertRule } from "./alerts";
import { BASE_CURRENCIES, type BaseCurrency, type Currency, type Holding } from "./types";

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

export interface Portfolio {
  id: string;
  name: string;
}

export interface NewHolding {
  portfolioId: string;
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

export async function getBaseCurrency(sb: SupabaseClient): Promise<BaseCurrency> {
  const { data, error } = await sb.from("profiles").select("base_currency").maybeSingle();
  if (error) throw new Error(error.message);
  const c = data?.base_currency as BaseCurrency | undefined;
  return c && BASE_CURRENCIES.includes(c) ? c : "USD";
}

export async function setBaseCurrency(sb: SupabaseClient, userId: string, currency: BaseCurrency) {
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

// --- Portfolios ------------------------------------------------------------

/** Every user has an Investment and a Trading portfolio (created by migration 0004 and at signup). */
export async function listPortfolios(sb: SupabaseClient): Promise<Portfolio[]> {
  const rows = check(await sb.from("portfolios").select("id, name").order("position").order("created_at"));
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

// --- Holdings --------------------------------------------------------------

interface HoldingRow {
  id: string;
  portfolio_id: string;
  symbol: string;
  shares: number | string;
  buy_price: number | string;
  buy_date: string;
  currency: Currency;
}

const toHolding = (r: HoldingRow): Holding => ({
  id: r.id,
  portfolioId: r.portfolio_id,
  symbol: r.symbol,
  shares: Number(r.shares),
  buyPrice: Number(r.buy_price),
  buyDate: r.buy_date,
  currency: r.currency,
});

export async function listHoldings(sb: SupabaseClient): Promise<Holding[]> {
  const rows = check(
    await sb.from("holdings").select("id, portfolio_id, symbol, shares, buy_price, buy_date, currency").order("buy_date"),
  );
  return (rows as HoldingRow[]).map(toHolding);
}

export async function addHolding(sb: SupabaseClient, h: NewHolding) {
  check(
    await sb.from("holdings").insert({
      portfolio_id: h.portfolioId,
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
      .update({ portfolio_id: h.portfolioId, symbol: h.symbol, shares: h.shares, buy_price: h.buyPrice, buy_date: h.buyDate, currency: h.currency })
      .eq("id", id),
  );
}

export async function deleteHolding(sb: SupabaseClient, id: string) {
  check(await sb.from("holdings").delete().eq("id", id));
}

// --- Alerts ----------------------------------------------------------------

export interface Alert extends AlertRule {
  id: string;
  active: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

export interface AlertEvent {
  id: string;
  symbol: string;
  kind: AlertKind;
  threshold: number;
  price: number;
  changePercent: number | null;
  currency: string | null;
  emailed: boolean;
  triggeredAt: string;
}

export async function listAlerts(sb: SupabaseClient): Promise<Alert[]> {
  const rows = check(
    await sb.from("alerts").select("id, symbol, kind, threshold, active, triggered_at, created_at").order("created_at", { ascending: false }),
  );
  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    kind: r.kind as AlertKind,
    threshold: Number(r.threshold),
    active: r.active,
    triggeredAt: r.triggered_at,
    createdAt: r.created_at,
  }));
}

export async function createAlert(sb: SupabaseClient, rule: AlertRule) {
  check(await sb.from("alerts").insert({ symbol: rule.symbol, kind: rule.kind, threshold: rule.threshold }));
}

export async function setAlertActive(sb: SupabaseClient, id: string, active: boolean) {
  check(await sb.from("alerts").update({ active, ...(active ? { triggered_at: null } : {}) }).eq("id", id));
}

export async function deleteAlert(sb: SupabaseClient, id: string) {
  check(await sb.from("alerts").delete().eq("id", id));
}

export async function listAlertEvents(sb: SupabaseClient, limit = 30): Promise<AlertEvent[]> {
  const rows = check(
    await sb
      .from("alert_events")
      .select("id, symbol, kind, threshold, price, change_percent, currency, emailed, triggered_at")
      .order("triggered_at", { ascending: false })
      .limit(limit),
  );
  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    kind: r.kind as AlertKind,
    threshold: Number(r.threshold),
    price: Number(r.price),
    changePercent: r.change_percent == null ? null : Number(r.change_percent),
    currency: r.currency,
    emailed: r.emailed,
    triggeredAt: r.triggered_at,
  }));
}
