-- ThePekFinance: separate Investment and Trading portfolios, and USD / AUD totals.

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index on public.portfolios (user_id);

alter table public.portfolios enable row level security;

create policy "own portfolios" on public.portfolios
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Every existing user gets both portfolios; existing holdings go to Investment.
insert into public.portfolios (user_id, name, position)
select u.id, p.name, p.position
from auth.users u
cross join (values ('Investment', 0), ('Trading', 1)) as p (name, position);

alter table public.holdings add column portfolio_id uuid references public.portfolios on delete cascade;

update public.holdings h
set portfolio_id = p.id
from public.portfolios p
where p.user_id = h.user_id and p.name = 'Investment';

alter table public.holdings alter column portfolio_id set not null;
create index on public.holdings (portfolio_id);

-- A holding may only point at one of the user's own portfolios.
drop policy "own holdings" on public.holdings;
create policy "own holdings" on public.holdings
  for all using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid()))
  );

-- New users get both portfolios too.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.watchlists (user_id, name) values (new.id, 'My watchlist');
  insert into public.portfolios (user_id, name, position) values (new.id, 'Investment', 0), (new.id, 'Trading', 1);
  return new;
end;
$$;

-- Totals are shown in USD or AUD (stocks keep their own trading currency).
alter table public.profiles drop constraint profiles_base_currency_check;
update public.profiles set base_currency = 'USD' where base_currency not in ('USD', 'AUD');
alter table public.profiles add constraint profiles_base_currency_check check (base_currency in ('USD', 'AUD'));
