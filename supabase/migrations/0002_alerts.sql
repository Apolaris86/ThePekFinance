-- ThePekFinance: price alerts and their trigger history.
-- Alerts are one-shot: when one fires it is deactivated until the user re-arms it.

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  symbol text not null check (symbol ~ '^\^?[A-Z0-9][A-Z0-9.\-=]{0,14}$'),
  -- above / below: price crosses threshold; move: |day change %| reaches threshold
  kind text not null check (kind in ('above', 'below', 'move')),
  threshold numeric not null check (threshold > 0),
  active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid references public.alerts on delete set null,
  user_id uuid not null references auth.users on delete cascade,
  symbol text not null,
  kind text not null,
  threshold numeric not null,
  price numeric not null,
  change_percent numeric,
  currency text,
  emailed boolean not null default false,
  triggered_at timestamptz not null default now()
);

create index on public.alerts (user_id);
create index alerts_active_idx on public.alerts (active) where active;
create index on public.alert_events (user_id, triggered_at desc);

alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;

create policy "own alerts" on public.alerts
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Events are written by the check-alerts function (service role); users only read theirs.
create policy "read own alert events" on public.alert_events
  for select using (user_id = (select auth.uid()));
