-- ThePekFinance: profiles, watchlists and portfolio holdings.
-- Every table is owned by a user and protected by row level security.

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  base_currency text not null default 'USD' check (base_currency in ('USD', 'SGD', 'EUR')),
  created_at timestamptz not null default now()
);

create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  symbol text not null check (symbol ~ '^\^?[A-Z0-9][A-Z0-9.\-=]{0,14}$'),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (watchlist_id, symbol)
);

-- One row per purchase lot; the app groups lots by symbol.
create table public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  symbol text not null check (symbol ~ '^\^?[A-Z0-9][A-Z0-9.\-=]{0,14}$'),
  shares numeric not null check (shares > 0),
  buy_price numeric not null check (buy_price >= 0),
  buy_date date not null,
  currency text not null check (currency in ('USD', 'SGD', 'EUR')),
  created_at timestamptz not null default now()
);

create index on public.watchlists (user_id);
create index on public.watchlist_items (watchlist_id);
create index on public.holdings (user_id);

alter table public.profiles enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.holdings enable row level security;

create policy "own profile" on public.profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own watchlists" on public.watchlists
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own watchlist items" on public.watchlist_items
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid()))
  );

create policy "own holdings" on public.holdings
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- New users get a profile and a default watchlist.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.watchlists (user_id, name) values (new.id, 'My watchlist');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
