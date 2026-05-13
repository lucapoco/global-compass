-- Global Pulse — expected public schema (matches src/integrations/supabase/types.ts)
-- Apply in Supabase SQL Editor or: supabase db push / psql
-- After creation, enable RLS and policies appropriate for your app (anon vs authenticated).

-- Extensions (UUID generation)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- saved_countries
-- ---------------------------------------------------------------------------
create table if not exists public.saved_countries (
  id uuid primary key default gen_random_uuid(),
  country_name text not null,
  country_code text,
  capital text,
  region text,
  population bigint,
  flag_url text,
  notes text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- saved_alerts
-- ---------------------------------------------------------------------------
create table if not exists public.saved_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  severity text not null,
  location text,
  description text,
  source text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- saved_intelligence
-- ---------------------------------------------------------------------------
create table if not exists public.saved_intelligence (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text,
  severity text,
  country text,
  source text,
  url text,
  image_url text,
  published_at timestamptz,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- user_feedback
-- ---------------------------------------------------------------------------
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  name text,
  message text not null,
  rating integer,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- project_logs (audit / activity log from the app)
-- ---------------------------------------------------------------------------
create table if not exists public.project_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  details text,
  created_at timestamptz default now()
);

-- Helpful indexes
create index if not exists saved_countries_created_at_idx on public.saved_countries (created_at desc);
create index if not exists saved_alerts_created_at_idx on public.saved_alerts (created_at desc);
create index if not exists saved_intelligence_created_at_idx on public.saved_intelligence (created_at desc);
create index if not exists user_feedback_created_at_idx on public.user_feedback (created_at desc);
create index if not exists project_logs_created_at_idx on public.project_logs (created_at desc);

comment on table public.saved_countries is 'Bookmarked countries from the Countries / map flows.';
comment on table public.saved_alerts is 'User-saved alert pins (map, earthquakes, etc.).';
comment on table public.saved_intelligence is 'Bookmarked intelligence feed items.';
comment on table public.user_feedback is 'About page / feedback form submissions.';
comment on table public.project_logs is 'Lightweight action log written by supabaseService.';
