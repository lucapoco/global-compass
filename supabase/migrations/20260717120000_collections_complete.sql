-- =============================================================================
-- Collections completeness — update policies + article ops indexes
-- Migration: 20260717120000_collections_complete.sql
-- =============================================================================
-- Ensures collections / collection_articles support full CRUD with RLS.
-- Safe to re-run (idempotent).
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

-- ---------------------------------------------------------------------------
-- Tables (create if missing — matches prior auth migrations)
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
create index if not exists collections_user_updated_idx
  on public.collections (user_id, updated_at desc);
create index if not exists collections_user_name_idx
  on public.collections (user_id, lower(name));
create index if not exists collection_articles_collection_idx
  on public.collection_articles (collection_id, added_at desc);
create index if not exists collection_articles_article_idx
  on public.collection_articles (article_id);

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.collections enable row level security;
alter table public.collection_articles enable row level security;

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

drop policy if exists "collection_articles_select_own" on public.collection_articles;
drop policy if exists "collection_articles_insert_own" on public.collection_articles;
drop policy if exists "collection_articles_update_own" on public.collection_articles;
drop policy if exists "collection_articles_delete_own" on public.collection_articles;

create policy "collection_articles_select_own" on public.collection_articles
  for select to authenticated using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );
create policy "collection_articles_insert_own" on public.collection_articles
  for insert to authenticated with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );
create policy "collection_articles_update_own" on public.collection_articles
  for update to authenticated using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );
create policy "collection_articles_delete_own" on public.collection_articles
  for delete to authenticated using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id and c.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.collections to authenticated;
grant select, insert, update, delete on public.collection_articles to authenticated;

revoke all on public.collections from anon;
revoke all on public.collection_articles from anon;
