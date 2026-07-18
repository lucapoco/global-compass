-- =============================================================================
-- Global Cursor Intelligence — User workspace isolation (v2)
-- Migration: 20260716170000_user_workspace_isolation.sql
-- =============================================================================
-- Idempotent / safe to re-run. Builds on 20260716120000_auth_personalization.sql
--
-- Goal: every authenticated user has a private SaaS workspace.
-- Guests browse freely; cloud features require auth.uid().
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------
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
-- PROFILES  (linked 1:1 to auth.users)
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 200),
  avatar_url text check (char_length(avatar_url) <= 2000),
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'ro')),
  theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Upgrade path from v1 columns (display_name / preferred_locale)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'display_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) then
    alter table public.profiles rename column display_name to full_name;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'full_name'
  ) then
    alter table public.profiles add column full_name text;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'preferred_locale'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'preferred_language'
  ) then
    alter table public.profiles rename column preferred_locale to preferred_language;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'preferred_language'
  ) then
    alter table public.profiles
      add column preferred_language text not null default 'en';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'theme'
  ) then
    alter table public.profiles
      add column theme text not null default 'system';
  end if;
end $$;

create index if not exists profiles_email_idx on public.profiles (email);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- USER PREFERENCES  (1:1)
-- =============================================================================
create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  language text not null default 'en' check (language in ('en', 'ro')),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  favourite_countries text[] not null default '{}',
  favourite_topics text[] not null default '{}',
  favourite_sources text[] not null default '{}',
  ai_preferences jsonb not null default '{}'::jsonb,
  email_notifications boolean not null default true,
  push_notifications boolean not null default true,
  personalized_feed boolean not null default true,
  digest_frequency text not null default 'daily'
    check (digest_frequency in ('off', 'daily', 'weekly')),
  -- legacy aliases kept for backwards compatibility
  preferred_categories text[] not null default '{}',
  preferred_countries text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'language'
  ) then
    alter table public.preferences add column language text not null default 'en';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'favourite_countries'
  ) then
    alter table public.preferences add column favourite_countries text[] not null default '{}';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'favourite_topics'
  ) then
    alter table public.preferences add column favourite_topics text[] not null default '{}';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'favourite_sources'
  ) then
    alter table public.preferences add column favourite_sources text[] not null default '{}';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'preferences' and column_name = 'ai_preferences'
  ) then
    alter table public.preferences add column ai_preferences jsonb not null default '{}'::jsonb;
  end if;
end $$;

-- Backfill favourites from legacy arrays when empty
update public.preferences
set favourite_countries = preferred_countries
where coalesce(array_length(favourite_countries, 1), 0) = 0
  and coalesce(array_length(preferred_countries, 1), 0) > 0;

update public.preferences
set favourite_topics = preferred_categories
where coalesce(array_length(favourite_topics, 1), 0) = 0
  and coalesce(array_length(preferred_categories, 1), 0) > 0;

drop trigger if exists preferences_set_updated_at on public.preferences;
create trigger preferences_set_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- =============================================================================
-- MISSION CONTROL WORKSPACE  (per-user operational config)
-- =============================================================================
create table if not exists public.mission_control_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tracked_topics text[] not null default '{}',
  monitored_keywords text[] not null default '{}',
  watched_countries text[] not null default '{}',
  watched_sources text[] not null default '{}',
  alert_rules jsonb not null default '[]'::jsonb,
  ai_monitoring jsonb not null default '{}'::jsonb,
  widgets jsonb not null default '[]'::jsonb,
  widget_layout jsonb not null default '{}'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  notification_preferences jsonb not null default '{}'::jsonb,
  presentation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.mission_control_settings is
  'Per-user Mission Control workspace: topics, keywords, widgets, filters, alerts.';

create index if not exists mission_control_settings_updated_idx
  on public.mission_control_settings (updated_at desc);

drop trigger if exists mission_control_settings_set_updated_at on public.mission_control_settings;
create trigger mission_control_settings_set_updated_at
  before update on public.mission_control_settings
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SAVED ARTICLES
-- =============================================================================
create table if not exists public.saved_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id text not null check (char_length(article_id) <= 300),
  article_url text check (char_length(article_url) <= 2000),
  article_title text not null check (char_length(article_title) <= 500),
  article_image text check (char_length(article_image) <= 2000),
  source text check (char_length(source) <= 200),
  category text check (char_length(category) <= 80),
  saved_at timestamptz not null default timezone('utc', now()),
  -- optional enrichment (kept for app compatibility)
  summary text check (char_length(summary) <= 4000),
  severity text check (char_length(severity) <= 40),
  country text check (char_length(country) <= 120),
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, article_id)
);

-- Upgrade path from v1 column names
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'title'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'article_title'
  ) then
    alter table public.saved_articles rename column title to article_title;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'url'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'article_url'
  ) then
    alter table public.saved_articles rename column url to article_url;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'image_url'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'article_image'
  ) then
    alter table public.saved_articles rename column image_url to article_image;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'saved_at'
  ) then
    alter table public.saved_articles
      add column saved_at timestamptz not null default timezone('utc', now());
    update public.saved_articles set saved_at = coalesce(created_at, timezone('utc', now()));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'article_title'
  ) then
    alter table public.saved_articles add column article_title text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'article_url'
  ) then
    alter table public.saved_articles add column article_url text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'saved_articles' and column_name = 'article_image'
  ) then
    alter table public.saved_articles add column article_image text;
  end if;
end $$;

create index if not exists saved_articles_user_saved_idx
  on public.saved_articles (user_id, saved_at desc);
create index if not exists saved_articles_user_category_idx
  on public.saved_articles (user_id, category);

drop trigger if exists saved_articles_set_updated_at on public.saved_articles;
create trigger saved_articles_set_updated_at
  before update on public.saved_articles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- READING HISTORY
-- =============================================================================
create table if not exists public.reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id text not null check (char_length(article_id) <= 300),
  opened_at timestamptz not null default timezone('utc', now()),
  -- enrichment for UI (optional)
  title text check (char_length(title) <= 500),
  summary text check (char_length(summary) <= 2000),
  source text check (char_length(source) <= 200),
  url text check (char_length(url) <= 2000),
  category text check (char_length(category) <= 80),
  country text check (char_length(country) <= 120),
  progress_pct smallint not null default 100 check (progress_pct between 0 and 100),
  unique (user_id, article_id)
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_history' and column_name = 'read_at'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_history' and column_name = 'opened_at'
  ) then
    alter table public.reading_history rename column read_at to opened_at;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reading_history' and column_name = 'opened_at'
  ) then
    alter table public.reading_history
      add column opened_at timestamptz not null default timezone('utc', now());
  end if;
end $$;

create index if not exists reading_history_user_opened_idx
  on public.reading_history (user_id, opened_at desc);

-- =============================================================================
-- COLLECTIONS (kept from v1 — still user-isolated)
-- =============================================================================
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  color text check (char_length(color) <= 32),
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, name)
);

create table if not exists public.collection_articles (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  article_id text not null check (char_length(article_id) <= 300),
  title text not null check (char_length(title) <= 500),
  url text check (char_length(url) <= 2000),
  source text check (char_length(source) <= 200),
  added_at timestamptz not null default timezone('utc', now()),
  unique (collection_id, article_id)
);

create index if not exists collections_user_created_idx
  on public.collections (user_id, created_at desc);
create index if not exists collection_articles_collection_idx
  on public.collection_articles (collection_id, added_at desc);

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- =============================================================================
-- NOTIFICATIONS (user-isolated)
-- =============================================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (char_length(type) <= 60),
  title text not null check (char_length(title) <= 300),
  body text check (char_length(body) <= 2000),
  href text check (char_length(href) <= 500),
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id) where read_at is null;

-- =============================================================================
-- SIGNUP BOOTSTRAP — profile + preferences + empty Mission Control workspace
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, preferred_language, theme)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    'en',
    'system'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = timezone('utc', now());

  insert into public.preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.mission_control_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill MC settings for existing users
insert into public.mission_control_settings (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data ->> 'full_name', split_part(coalesce(email, 'user'), '@', 1))
from auth.users
on conflict (id) do nothing;

-- =============================================================================
-- ROW LEVEL SECURITY — strict owner isolation
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.mission_control_settings enable row level security;
alter table public.saved_articles enable row level security;
alter table public.reading_history enable row level security;
alter table public.collections enable row level security;
alter table public.collection_articles enable row level security;
alter table public.notifications enable row level security;

-- Helper macro pattern: only auth.uid() rows

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- preferences
drop policy if exists "preferences_select_own" on public.preferences;
drop policy if exists "preferences_insert_own" on public.preferences;
drop policy if exists "preferences_update_own" on public.preferences;
create policy "preferences_select_own" on public.preferences
  for select to authenticated using (auth.uid() = user_id);
create policy "preferences_insert_own" on public.preferences
  for insert to authenticated with check (auth.uid() = user_id);
create policy "preferences_update_own" on public.preferences
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- mission_control_settings
drop policy if exists "mc_settings_select_own" on public.mission_control_settings;
drop policy if exists "mc_settings_insert_own" on public.mission_control_settings;
drop policy if exists "mc_settings_update_own" on public.mission_control_settings;
drop policy if exists "mc_settings_delete_own" on public.mission_control_settings;
create policy "mc_settings_select_own" on public.mission_control_settings
  for select to authenticated using (auth.uid() = user_id);
create policy "mc_settings_insert_own" on public.mission_control_settings
  for insert to authenticated with check (auth.uid() = user_id);
create policy "mc_settings_update_own" on public.mission_control_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "mc_settings_delete_own" on public.mission_control_settings
  for delete to authenticated using (auth.uid() = user_id);

-- saved_articles
drop policy if exists "saved_articles_select_own" on public.saved_articles;
drop policy if exists "saved_articles_insert_own" on public.saved_articles;
drop policy if exists "saved_articles_update_own" on public.saved_articles;
drop policy if exists "saved_articles_delete_own" on public.saved_articles;
create policy "saved_articles_select_own" on public.saved_articles
  for select to authenticated using (auth.uid() = user_id);
create policy "saved_articles_insert_own" on public.saved_articles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "saved_articles_update_own" on public.saved_articles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "saved_articles_delete_own" on public.saved_articles
  for delete to authenticated using (auth.uid() = user_id);

-- reading_history
drop policy if exists "reading_history_select_own" on public.reading_history;
drop policy if exists "reading_history_insert_own" on public.reading_history;
drop policy if exists "reading_history_update_own" on public.reading_history;
drop policy if exists "reading_history_delete_own" on public.reading_history;
create policy "reading_history_select_own" on public.reading_history
  for select to authenticated using (auth.uid() = user_id);
create policy "reading_history_insert_own" on public.reading_history
  for insert to authenticated with check (auth.uid() = user_id);
create policy "reading_history_update_own" on public.reading_history
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reading_history_delete_own" on public.reading_history
  for delete to authenticated using (auth.uid() = user_id);

-- collections
drop policy if exists "collections_select_own" on public.collections;
drop policy if exists "collections_insert_own" on public.collections;
drop policy if exists "collections_update_own" on public.collections;
drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_select_own" on public.collections
  for select to authenticated using (auth.uid() = user_id);
create policy "collections_insert_own" on public.collections
  for insert to authenticated with check (auth.uid() = user_id);
create policy "collections_update_own" on public.collections
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collections_delete_own" on public.collections
  for delete to authenticated using (auth.uid() = user_id);

-- collection_articles via parent ownership
drop policy if exists "collection_articles_select_own" on public.collection_articles;
drop policy if exists "collection_articles_insert_own" on public.collection_articles;
drop policy if exists "collection_articles_delete_own" on public.collection_articles;
create policy "collection_articles_select_own" on public.collection_articles
  for select to authenticated using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );
create policy "collection_articles_insert_own" on public.collection_articles
  for insert to authenticated with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );
create policy "collection_articles_delete_own" on public.collection_articles
  for delete to authenticated using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );

-- notifications
drop policy if exists "notifications_select_own" on public.notifications;
drop policy if exists "notifications_insert_own" on public.notifications;
drop policy if exists "notifications_update_own" on public.notifications;
drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (auth.uid() = user_id);
create policy "notifications_insert_own" on public.notifications
  for insert to authenticated with check (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (auth.uid() = user_id);

-- =============================================================================
-- GRANTS — authenticated only (anon has zero access to personal tables)
-- =============================================================================
grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.preferences to authenticated;
grant select, insert, update, delete on public.mission_control_settings to authenticated;
grant select, insert, update, delete on public.saved_articles to authenticated;
grant select, insert, update, delete on public.reading_history to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, delete on public.collection_articles to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

revoke all on public.profiles from anon;
revoke all on public.preferences from anon;
revoke all on public.mission_control_settings from anon;
revoke all on public.saved_articles from anon;
revoke all on public.reading_history from anon;
revoke all on public.collections from anon;
revoke all on public.collection_articles from anon;
revoke all on public.notifications from anon;
