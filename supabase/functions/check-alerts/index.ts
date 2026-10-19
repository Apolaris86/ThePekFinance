// check-alerts: run every minute on weekdays by pg_cron (see supabase/cron/schedule-alerts.sql).
// Fetches quotes for all active alerts, fires the ones whose condition holds,
// records an alert_event and emails the owner via Resend. Alerts are one-shot.
//
// Deploy with JWT verification off (the caller authenticates with x-cron-secret):
//   npm run deploy:alerts

import { createClient } from "npm:@supabase/supabase-js@2";
import YahooFinance from "npm:yahoo-finance2@4.0.4";
import { type AlertKind, describeAlert, isTriggered } from "../_shared/alerts.ts";

interface AlertRow {
  id: string;
  user_id: string;
  symbol: string;
  kind: AlertKind;
  threshold: number | string;
}

interface Fired {
  alert: AlertRow;
  price: number;
  changePercent: number;
  currency?: string;
}

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Forbidden" }, 403);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: alerts, error } = await sb.from("alerts").select("id, user_id, symbol, kind, threshold").eq("active", true);
  if (error) return json({ error: error.message }, 500);
  if (!alerts?.length) return json({ checked: 0, triggered: 0 });

  const symbols = [...new Set((alerts as AlertRow[]).map((a) => a.symbol))];
  // deno-lint-ignore no-explicit-any
  const quotes = (await yf.quote(symbols)) as any[];
  const bySymbol = new Map(quotes.filter((q) => q?.regularMarketPrice != null).map((q) => [q.symbol as string, q]));

  const candidates: Fired[] = [];
  for (const alert of alerts as AlertRow[]) {
    const q = bySymbol.get(alert.symbol);
    if (!q) continue;
    const quote = {
      price: q.regularMarketPrice as number,
      changePercent: (q.regularMarketChangePercent as number) ?? 0,
      currency: q.currency as string | undefined,
      marketState: q.marketState as string | undefined,
    };
    if (isTriggered({ symbol: alert.symbol, kind: alert.kind, threshold: Number(alert.threshold) }, quote)) {
      candidates.push({ alert, ...quote });
    }
  }
  if (candidates.length === 0) return json({ checked: alerts.length, triggered: 0 });

  // Claim the alerts atomically (still active -> inactive) so overlapping runs can't double-fire.
  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await sb
    .from("alerts")
    .update({ active: false, triggered_at: now })
    .in("id", candidates.map((c) => c.alert.id))
    .eq("active", true)
    .select("id");
  if (claimError) return json({ error: claimError.message }, 500);
  const claimedIds = new Set((claimed ?? []).map((r) => r.id as string));
  const fired = candidates.filter((c) => claimedIds.has(c.alert.id));

  const { data: events, error: eventError } = await sb
    .from("alert_events")
    .insert(
      fired.map((f) => ({
        alert_id: f.alert.id,
        user_id: f.alert.user_id,
        symbol: f.alert.symbol,
        kind: f.alert.kind,
        threshold: f.alert.threshold,
        price: f.price,
        change_percent: f.changePercent,
        currency: f.currency,
        triggered_at: now,
      })),
    )
    .select("id, user_id");
  if (eventError) return json({ error: eventError.message }, 500);

  // One email per user listing everything that fired this minute.
  const byUser = Map.groupBy(fired, (f) => f.alert.user_id);
  let emailed = 0;
  for (const [userId, items] of byUser) {
    if (await sendEmail(sb, userId, items)) {
      emailed += items.length;
      const ids = (events ?? []).filter((e) => e.user_id === userId).map((e) => e.id as string);
      await sb.from("alert_events").update({ emailed: true }).in("id", ids);
    }
  }

  return json({ checked: alerts.length, triggered: fired.length, emailed });
});

// deno-lint-ignore no-explicit-any
async function sendEmail(sb: any, userId: string, items: Fired[]): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return false;
  const { data } = await sb.auth.admin.getUserById(userId);
  const to = data?.user?.email;
  if (!to) return false;

  const appUrl = Deno.env.get("APP_URL");
  const lines = items.map((f) => {
    const what = describeAlert({ symbol: f.alert.symbol, kind: f.alert.kind, threshold: Number(f.alert.threshold) }, f.currency);
    const now = `now ${f.price.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${f.currency ?? ""} (${f.changePercent >= 0 ? "+" : ""}${f.changePercent.toFixed(2)}% today)`;
    return { what, now, symbol: f.alert.symbol };
  });
  const subject =
    items.length === 1 ? `Alert: ${lines[0].what}` : `${items.length} price alerts triggered (${lines.map((l) => l.symbol).join(", ")})`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px">
      <h2 style="margin:0 0 12px">ThePekFinance alert${items.length > 1 ? "s" : ""}</h2>
      <ul style="padding-left:18px">
        ${lines
          .map((l) => {
            const label = appUrl
              ? `<a href="${escapeHtml(`${appUrl}/quote/${encodeURIComponent(l.symbol)}`)}">${escapeHtml(l.what)}</a>`
              : escapeHtml(l.what);
            return `<li style="margin-bottom:8px">${label}<br><span style="color:#5f6368">${escapeHtml(l.now)}</span></li>`;
          })
          .join("")}
      </ul>
      <p style="color:#5f6368;font-size:12px">These alerts are now paused. Re-arm them from the Alerts page.</p>
    </div>`;
  const text = lines.map((l) => `- ${l.what}: ${l.now}`).join("\n") + "\n\nThese alerts are now paused. Re-arm them from the Alerts page.";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("ALERT_FROM") ?? "ThePekFinance <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!res.ok) console.error("Resend error", res.status, await res.text());
  return res.ok;
}
