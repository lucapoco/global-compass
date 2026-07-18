-- =============================================================================
-- Global Pulse / Global Cursor Intelligence
-- Auth + personalization schema (Supabase / PostgreSQL)
-- =============================================================================
-- Apply in Supabase SQL Editor or via: supabase db push
--
-- Prerequisites:
--   • Auth providers enabled in Dashboard → Authentication → Providers
--     (Email, Google, GitHub)
--   • Site URL + redirect URLs configured for OAuth callbacks
--
-- Design:
--   • Guests browse freely (no account required)
--   • Authenticated users get persistence & personalization
--   • All personal tables reference auth.users(id)
--   • RLS: users can only access their own rows
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helper: updated_at trigger function
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

-- ---------------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text check (char_length(display_name) <= 120),
  avatar_url text check (char_length(avatar_url) <= 2000),
  preferred_locale text not null default 'en'
    check (preferred_locale in ('en', 'ro')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_email_idx on public.profiles (email);

comment on table public.profiles is 'App profile mirrored from auth.users (display name, avatar, locale).';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- preferences  (1:1 personalization settings) — created before signup trigger
-- ---------------------------------------------------------------------------
create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'system'
    check (theme in ('light', 'dark', 'system')),
  email_notifications boolean not null default true,
  push_notifications boolean not null default true,
  personalized_feed boolean not null default true,
  preferred_categories text[] not null default '{}',
  preferred_countries text[] not null default '{}',
  digest_frequency text not null default 'daily'
    check (digest_frequency in ('off', 'daily', 'weekly')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.preferences is 'Per-user personalization and notification preferences.';

drop trigger if exists preferences_set_updated_at on public.preferences;
create trigger preferences_set_updated_at
  before update on public.preferences
  for each row execute function public.set_updated_at();

-- Auto-create profile + preferences when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
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
    )
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url),
    updated_at = timezone('utc', now());

  insert into public.preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- saved_articles  (cloud bookmarks — requires auth)
-- ---------------------------------------------------------------------------
create table if not exists public.saved_articles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id text not null check (char_length(article_id) <= 300),
  title text not null check (char_length(title) <= 500),
  summary text check (char_length(summary) <= 4000),
  source text check (char_length(source) <= 200),
  url text check (char_length(url) <= 2000),
  image_url text check (char_length(image_url) <= 2000),
  category text check (char_length(category) <= 80),
  severity text check (char_length(severity) <= 40),
  country text check (char_length(country) <= 120),
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, article_id)
);

create index if not exists saved_articles_user_created_idx
  on public.saved_articles (user_id, created_at desc);
create index if not exists saved_articles_user_category_idx
  on public.saved_articles (user_id, category);

comment on table public.saved_articles is 'Authenticated user bookmarks (articles / intelligence items).';

drop trigger if exists saved_articles_set_updated_at on public.saved_articles;
create trigger saved_articles_set_updated_at
  before update on public.saved_articles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reading_history
-- ---------------------------------------------------------------------------
-- Uses opened_at (canonical). Older drafts used read_at — migrate if present.
create table if not exists public.reading_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  article_id text not null check (char_length(article_id) <= 300),
  title text not null check (char_length(title) <= 500),
  summary text check (char_length(summary) <= 2000),
  source text check (char_length(source) <= 200),
  url text check (char_length(url) <= 2000),
  category text check (char_length(category) <= 80),
  country text check (char_length(country) <= 120),
  opened_at timestamptz not null default timezone('utc', now()),
  progress_pct smallint not null default 100
    check (progress_pct between 0 and 100),
  unique (user_id, article_id)
);

do $$
begin
  -- Upgrade: read_at → opened_at (if an earlier partial schema used read_at)
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

drop index if exists public.reading_history_user_read_idx;
create index if not exists reading_history_user_opened_idx
  on public.reading_history (user_id, opened_at desc);

comment on table public.reading_history is 'Per-user reading history for personalization.';

-- ---------------------------------------------------------------------------
-- collections
-- ---------------------------------------------------------------------------
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

create index if not exists collections_user_created_idx
  on public.collections (user_id, created_at desc);

comment on table public.collections is 'User-curated article collections.';

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- collection_articles  (M:N)
-- ---------------------------------------------------------------------------
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

create index if not exists collection_articles_collection_idx
  on public.collection_articles (collection_id, added_at desc);

comment on table public.collection_articles is 'Articles belonging to a collection.';

-- ---------------------------------------------------------------------------
-- notifications  (in-app, cloud-synced)
-- ---------------------------------------------------------------------------
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

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'notifications' and column_name = 'read_at'
  ) then
    create index if not exists notifications_user_unread_idx
      on public.notifications (user_id)
      where read_at is null;
  end if;
end $$;

comment on table public.notifications is 'Cloud-synced in-app notifications for authenticated users.';

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.saved_articles enable row level security;
alter table public.reading_history enable row level security;
alter table public.collections enable row level security;
alter table public.collection_articles enable row level security;
alter table public.notifications enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- preferences
drop policy if exists "preferences_select_own" on public.preferences;
create policy "preferences_select_own"
  on public.preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "preferences_insert_own" on public.preferences;
create policy "preferences_insert_own"
  on public.preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "preferences_update_own" on public.preferences;
create policy "preferences_update_own"
  on public.preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- saved_articles
drop policy if exists "saved_articles_select_own" on public.saved_articles;
create policy "saved_articles_select_own"
  on public.saved_articles for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "saved_articles_insert_own" on public.saved_articles;
create policy "saved_articles_insert_own"
  on public.saved_articles for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "saved_articles_update_own" on public.saved_articles;
create policy "saved_articles_update_own"
  on public.saved_articles for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "saved_articles_delete_own" on public.saved_articles;
create policy "saved_articles_delete_own"
  on public.saved_articles for delete to authenticated
  using (auth.uid() = user_id);

-- reading_history
drop policy if exists "reading_history_select_own" on public.reading_history;
create policy "reading_history_select_own"
  on public.reading_history for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "reading_history_insert_own" on public.reading_history;
create policy "reading_history_insert_own"
  on public.reading_history for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "reading_history_update_own" on public.reading_history;
create policy "reading_history_update_own"
  on public.reading_history for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "reading_history_delete_own" on public.reading_history;
create policy "reading_history_delete_own"
  on public.reading_history for delete to authenticated
  using (auth.uid() = user_id);

-- collections
drop policy if exists "collections_select_own" on public.collections;
create policy "collections_select_own"
  on public.collections for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own"
  on public.collections for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "collections_update_own" on public.collections;
create policy "collections_update_own"
  on public.collections for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_delete_own"
  on public.collections for delete to authenticated
  using (auth.uid() = user_id);

-- collection_articles (ownership via parent collection)
drop policy if exists "collection_articles_select_own" on public.collection_articles;
create policy "collection_articles_select_own"
  on public.collection_articles for select to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "collection_articles_insert_own" on public.collection_articles;
create policy "collection_articles_insert_own"
  on public.collection_articles for insert to authenticated
  with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "collection_articles_delete_own" on public.collection_articles;
create policy "collection_articles_delete_own"
  on public.collection_articles for delete to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

-- notifications
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
  on public.notifications for delete to authenticated
  using (auth.uid() = user_id);

-- Inserts typically come from trusted server/edge functions; allow users to
-- insert their own notifications for client-side alerts if needed.
drop policy if exists "notifications_insert_own" on public.notifications;
create policy "notifications_insert_own"
  on public.notifications for insert to authenticated
  with check (auth.uid() = user_id);

-- =============================================================================
-- GRANTS
-- =============================================================================

grant usage on schema public to authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.preferences to authenticated;
grant select, insert, update, delete on public.saved_articles to authenticated;
grant select, insert, update, delete on public.reading_history to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, delete on public.collection_articles to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;

-- Anon has NO access to personal tables (guests use the app without cloud sync).
revoke all on public.profiles from anon;
revoke all on public.preferences from anon;
revoke all on public.saved_articles from anon;
revoke all on public.reading_history from anon;
revoke all on public.collections from anon;
revoke all on public.collection_articles from anon;
revoke all on public.notifications from anon;
