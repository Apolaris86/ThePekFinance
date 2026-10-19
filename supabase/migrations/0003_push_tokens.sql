-- ThePekFinance: Expo push tokens, one row per device.
-- The mobile app upserts its token after sign-in; check-alerts pushes to every token
-- of the alert's owner and deletes tokens Expo reports as DeviceNotRegistered.

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  token text not null unique check (token ~ '^Expo(nent)?PushToken\[.+\]$'),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "own push tokens" on public.push_tokens
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Track push delivery alongside email.
alter table public.alert_events add column pushed boolean not null default false;
