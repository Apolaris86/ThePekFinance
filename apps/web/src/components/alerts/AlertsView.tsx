"use client";

import Link from "next/link";
import { useState } from "react";
import { describeAlert, isTriggered, type Alert } from "@pek/shared";
import { useAuth } from "@/lib/auth";
import { useAlertEvents, useAlertMutations, useAlerts } from "@/lib/db-queries";
import { formatPercent, formatPrice } from "@/lib/format";
import { useQuote } from "@/lib/queries";
import { AlertForm } from "./AlertForm";

export function AlertsView() {
  const { user } = useAuth();
  const { data: alerts, isPending, isError } = useAlerts();
  const [creating, setCreating] = useState(false);

  const active = alerts?.filter((a) => a.active) ?? [];
  const paused = alerts?.filter((a) => !a.active) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-normal">Alerts</h1>
          <p className="mt-1 text-sm text-muted">Emails go to {user?.email}. Checked every minute, Monday to Friday.</p>
        </div>
        <button onClick={() => setCreating(true)} className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-background hover:opacity-90">
          + New alert
        </button>
      </div>
      <AlertForm open={creating} onClose={() => setCreating(false)} />

      {isPending ? (
        <div className="h-40 animate-pulse rounded-xl bg-surface" />
      ) : isError ? (
        <p className="text-down">Couldn&apos;t load your alerts.</p>
      ) : alerts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
          No alerts yet. Create one here, or from the bell on any stock page.
        </p>
      ) : (
        <>
          <AlertList title="Active" alerts={active} empty="No active alerts." />
          {paused.length > 0 && <AlertList title="Triggered or paused" alerts={paused} />}
        </>
      )}

      <History />
    </div>
  );
}

function AlertList({ title, alerts, empty }: { title: string; alerts: Alert[]; empty?: string }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">{title}</h2>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AlertRow({ alert: a }: { alert: Alert }) {
  const { data: q } = useQuote(a.symbol);
  const { setActive, remove } = useAlertMutations();
  const metNow = !!q && isTriggered(a, { price: q.price, changePercent: q.changePercent, marketState: q.marketState });
  const distance = q && a.kind !== "move" && !metNow ? ((a.threshold - q.price) / q.price) * 100 : null;
  const btn = "rounded-full px-3 py-1 text-xs font-medium transition hover:bg-surface";

  return (
    <li className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${a.active ? "" : "opacity-70"}`}>
      <Link
        href={`/quote/${encodeURIComponent(a.symbol)}`}
        className="w-20 shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-center font-mono text-xs font-semibold text-accent"
      >
        {a.symbol}
      </Link>
      <div className="min-w-0 flex-1 text-sm">
        <p>{describeAlert(a, q?.currency)}</p>
        <p className="text-xs text-muted">
          {q && `Now ${formatPrice(q.price, q.currency)} (${formatPercent(q.changePercent)} today)`}
          {distance != null && a.active && ` · ${formatPercent(distance)} away`}
          {metNow && a.active && " · condition met, fires on the next check"}
          {a.triggeredAt && ` · fired ${new Date(a.triggeredAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button onClick={() => setActive.mutate({ id: a.id, active: !a.active })} className={`${btn} ${a.active ? "text-muted" : "text-accent"}`}>
          {a.active ? "Pause" : "Re-arm"}
        </button>
        <button onClick={() => confirm(`Delete the alert "${describeAlert(a)}"?`) && remove.mutate(a.id)} className={`${btn} text-muted hover:text-down`}>
          Delete
        </button>
      </div>
    </li>
  );
}

function History() {
  const { data: events } = useAlertEvents();
  if (!events?.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">History</h2>
      <ul className="divide-y divide-border rounded-xl border border-border text-sm">
        {events.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-2.5">
            <span>{describeAlert(e, e.currency ?? undefined)}</span>
            <span className="tabular text-xs text-muted">
              at {e.price.toLocaleString("en-US", { maximumFractionDigits: 4 })} {e.currency} ·{" "}
              {new Date(e.triggeredAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              {e.emailed ? " · emailed" : " · not emailed"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
