-- =============================================================================
-- Watch Center + Saved Data — per-user isolation
-- Migration: 20260716180000_watch_center_saved_data_isolation.sql
-- =============================================================================
-- Makes Watch Center and Saved Data private to each authenticated user.
-- Guests cannot access these features (gated in the UI).
-- =============================================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- =============================================================================
-- USER WATCHLISTS (Watch Center)
-- =============================================================================
create table if not exists public.user_watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (char_length(type) <= 40),
  value text not null check (char_length(value) <= 200),
  label text not null check (char_length(label) <= 200),
  pinned boolean not null default false,
  favorite boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, type, value)
);

-- Upgrade path if table existed without user_id / pin flags
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_watchlists' and column_name = 'user_id'
  ) then
    alter table public.user_watchlists
      add column user_id uuid references auth.users (id) on delete cascade;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_watchlists' and column_name = 'pinned'
  ) then
    alter table public.user_watchlists add column pinned boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_watchlists' and column_name = 'favorite'
  ) then
    alter table public.user_watchlists add column favorite boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_watchlists' and column_name = 'updated_at'
  ) then
    alter table public.user_watchlists
      add column updated_at timestamptz not null default timezone('utc', now());
  end if;
end $$;

create index if not exists user_watchlists_user_created_idx
  on public.user_watchlists (user_id, created_at desc);

drop trigger if exists user_watchlists_set_updated_at on public.user_watchlists;
create trigger user_watchlists_set_updated_at
  before update on public.user_watchlists
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SAVED DATA TABLES — add user_id ownership
-- =============================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_countries' and column_name = 'user_id'
  ) then
    alter table public.saved_countries
      add column user_id uuid references auth.users (id) on delete cascade;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_alerts' and column_name = 'user_id'
  ) then
    alter table public.saved_alerts
      add column user_id uuid references auth.users (id) on delete cascade;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_intelligence' and column_name = 'user_id'
  ) then
    alter table public.saved_intelligence
      add column user_id uuid references auth.users (id) on delete cascade;
  end if;
end $$;

create index if not exists saved_countries_user_created_idx
  on public.saved_countries (user_id, created_at desc);
create index if not exists saved_alerts_user_created_idx
  on public.saved_alerts (user_id, created_at desc);
create index if not exists saved_intelligence_user_created_idx
  on public.saved_intelligence (user_id, created_at desc);

-- =============================================================================
-- RLS — drop public demo policies, enforce owner isolation
-- =============================================================================
alter table public.user_watchlists enable row level security;
alter table public.saved_countries enable row level security;
alter table public.saved_alerts enable row level security;
alter table public.saved_intelligence enable row level security;

-- user_watchlists
drop policy if exists "user_watchlists_select_own" on public.user_watchlists;
drop policy if exists "user_watchlists_insert_own" on public.user_watchlists;
drop policy if exists "user_watchlists_update_own" on public.user_watchlists;
drop policy if exists "user_watchlists_delete_own" on public.user_watchlists;
create policy "user_watchlists_select_own" on public.user_watchlists
  for select to authenticated using (auth.uid() = user_id);
create policy "user_watchlists_insert_own" on public.user_watchlists
  for insert to authenticated with check (auth.uid() = user_id);
create policy "user_watchlists_update_own" on public.user_watchlists
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_watchlists_delete_own" on public.user_watchlists
  for delete to authenticated using (auth.uid() = user_id);

-- saved_countries — remove open demo policies
drop policy if exists "public read saved_countries" on public.saved_countries;
drop policy if exists "public insert saved_countries" on public.saved_countries;
drop policy if exists "public delete saved_countries" on public.saved_countries;
drop policy if exists "saved_countries_select_own" on public.saved_countries;
drop policy if exists "saved_countries_insert_own" on public.saved_countries;
drop policy if exists "saved_countries_delete_own" on public.saved_countries;
create policy "saved_countries_select_own" on public.saved_countries
  for select to authenticated using (auth.uid() = user_id);
create policy "saved_countries_insert_own" on public.saved_countries
  for insert to authenticated with check (auth.uid() = user_id);
create policy "saved_countries_delete_own" on public.saved_countries
  for delete to authenticated using (auth.uid() = user_id);

-- saved_alerts
drop policy if exists "public read saved_alerts" on public.saved_alerts;
drop policy if exists "public insert saved_alerts" on public.saved_alerts;
drop policy if exists "public delete saved_alerts" on public.saved_alerts;
drop policy if exists "saved_alerts_select_own" on public.saved_alerts;
drop policy if exists "saved_alerts_insert_own" on public.saved_alerts;
drop policy if exists "saved_alerts_delete_own" on public.saved_alerts;
create policy "saved_alerts_select_own" on public.saved_alerts
  for select to authenticated using (auth.uid() = user_id);
create policy "saved_alerts_insert_own" on public.saved_alerts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "saved_alerts_delete_own" on public.saved_alerts
  for delete to authenticated using (auth.uid() = user_id);

-- saved_intelligence
drop policy if exists "public read saved_intelligence" on public.saved_intelligence;
drop policy if exists "public insert saved_intelligence" on public.saved_intelligence;
drop policy if exists "public delete saved_intelligence" on public.saved_intelligence;
drop policy if exists "saved_intelligence_select_own" on public.saved_intelligence;
drop policy if exists "saved_intelligence_insert_own" on public.saved_intelligence;
drop policy if exists "saved_intelligence_delete_own" on public.saved_intelligence;
create policy "saved_intelligence_select_own" on public.saved_intelligence
  for select to authenticated using (auth.uid() = user_id);
create policy "saved_intelligence_insert_own" on public.saved_intelligence
  for insert to authenticated with check (auth.uid() = user_id);
create policy "saved_intelligence_delete_own" on public.saved_intelligence
  for delete to authenticated using (auth.uid() = user_id);

-- Grants
grant select, insert, update, delete on public.user_watchlists to authenticated;
grant select, insert, delete on public.saved_countries to authenticated;
grant select, insert, delete on public.saved_alerts to authenticated;
grant select, insert, delete on public.saved_intelligence to authenticated;

revoke all on public.user_watchlists from anon;
revoke all on public.saved_countries from anon;
revoke all on public.saved_alerts from anon;
revoke all on public.saved_intelligence from anon;
