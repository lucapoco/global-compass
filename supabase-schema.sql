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

-- ai_briefings (optional — AI News Analyst saved Q&A)
create table if not exists public.ai_briefings (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  data_status text,
  created_at timestamptz default now()
);

create index if not exists ai_briefings_created_at_idx on public.ai_briefings (created_at desc);
comment on table public.ai_briefings is 'Saved Breaking News AI analyst briefings.';

alter table public.ai_briefings enable row level security;

-- generated_reports (Intelligence Reports — save/export from /reports)
create table if not exists public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  country text,
  event_id text,
  content text not null,
  data_status text,
  created_at timestamptz default now()
);

create index if not exists generated_reports_created_at_idx on public.generated_reports (created_at desc);
comment on table public.generated_reports is 'Saved intelligence reports from Global Pulse Reports.';

alter table public.generated_reports enable row level security;

comment on table public.user_feedback is 'About page / feedback form submissions.';
comment on table public.project_logs is 'Lightweight action log written by supabaseService.';

-- ---------------------------------------------------------------------------
-- Row Level Security (browser uses the **anon** key — policies are required)
-- ---------------------------------------------------------------------------
-- If RLS is enabled with no policies, PostgREST returns empty/errors and the app
-- cannot save or list rows. These policies allow the anon API role full CRUD on
-- these demo tables. **Tighten for production** (e.g. auth.uid(), service role only).
-- Re-run safely: DROP POLICY IF EXISTS … then CREATE POLICY …

alter table public.saved_countries enable row level security;
alter table public.saved_alerts enable row level security;
alter table public.saved_intelligence enable row level security;
alter table public.user_feedback enable row level security;
alter table public.project_logs enable row level security;

drop policy if exists "gp_anon_all_saved_countries" on public.saved_countries;
create policy "gp_anon_all_saved_countries"
  on public.saved_countries for all to anon using (true) with check (true);

drop policy if exists "gp_anon_all_saved_alerts" on public.saved_alerts;
create policy "gp_anon_all_saved_alerts"
  on public.saved_alerts for all to anon using (true) with check (true);

drop policy if exists "gp_anon_all_saved_intelligence" on public.saved_intelligence;
create policy "gp_anon_all_saved_intelligence"
  on public.saved_intelligence for all to anon using (true) with check (true);

drop policy if exists "gp_anon_all_ai_briefings" on public.ai_briefings;
create policy "gp_anon_all_ai_briefings"
  on public.ai_briefings for all to anon using (true) with check (true);

drop policy if exists "gp_anon_all_generated_reports" on public.generated_reports;
create policy "gp_anon_all_generated_reports"
  on public.generated_reports for select to anon using (true);
create policy "gp_anon_insert_generated_reports"
  on public.generated_reports for insert to anon with check (true);
create policy "gp_anon_delete_generated_reports"
  on public.generated_reports for delete to anon using (true);

drop policy if exists "gp_anon_all_user_feedback" on public.user_feedback;
create policy "gp_anon_all_user_feedback"
  on public.user_feedback for all to anon using (true) with check (true);

drop policy if exists "gp_anon_all_project_logs" on public.project_logs;
create policy "gp_anon_all_project_logs"
  on public.project_logs for all to anon using (true) with check (true);

-- Optional: logged-in users (if you add Supabase Auth later)
drop policy if exists "gp_auth_all_saved_countries" on public.saved_countries;
create policy "gp_auth_all_saved_countries"
  on public.saved_countries for all to authenticated using (true) with check (true);

drop policy if exists "gp_auth_all_saved_alerts" on public.saved_alerts;
create policy "gp_auth_all_saved_alerts"
  on public.saved_alerts for all to authenticated using (true) with check (true);

drop policy if exists "gp_auth_all_saved_intelligence" on public.saved_intelligence;
create policy "gp_auth_all_saved_intelligence"
  on public.saved_intelligence for all to authenticated using (true) with check (true);

drop policy if exists "gp_auth_all_ai_briefings" on public.ai_briefings;
create policy "gp_auth_all_ai_briefings"
  on public.ai_briefings for all to authenticated using (true) with check (true);

drop policy if exists "gp_auth_all_generated_reports" on public.generated_reports;
create policy "gp_auth_all_generated_reports"
  on public.generated_reports for all to authenticated using (true) with check (true);

drop policy if exists "gp_auth_all_user_feedback" on public.user_feedback;
create policy "gp_auth_all_user_feedback"
  on public.user_feedback for all to authenticated using (true) with check (true);

drop policy if exists "gp_auth_all_project_logs" on public.project_logs;
create policy "gp_auth_all_project_logs"
  on public.project_logs for all to authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.saved_countries to anon, authenticated;
grant select, insert, update, delete on public.saved_alerts to anon, authenticated;
grant select, insert, update, delete on public.saved_intelligence to anon, authenticated;
grant select, insert, update, delete on public.ai_briefings to anon, authenticated;
grant select, insert, delete on public.generated_reports to anon, authenticated;
grant select, insert, update, delete on public.user_feedback to anon, authenticated;
grant select, insert, update, delete on public.project_logs to anon, authenticated;
