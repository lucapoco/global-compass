
-- Global Pulse: demo-grade schema (public read/write for educational competition)
create table public.saved_countries (
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

create table public.saved_alerts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null,
  severity text not null,
  location text,
  description text,
  source text,
  created_at timestamptz default now()
);

create table public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  name text,
  message text not null,
  rating int,
  created_at timestamptz default now()
);

create table public.project_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  details text,
  created_at timestamptz default now()
);

alter table public.saved_countries enable row level security;
alter table public.saved_alerts enable row level security;
alter table public.user_feedback enable row level security;
alter table public.project_logs enable row level security;

-- Demo policies (educational project, no auth). Production would require stricter rules.
create policy "public read saved_countries" on public.saved_countries for select using (true);
create policy "public insert saved_countries" on public.saved_countries for insert with check (true);
create policy "public delete saved_countries" on public.saved_countries for delete using (true);

create policy "public read saved_alerts" on public.saved_alerts for select using (true);
create policy "public insert saved_alerts" on public.saved_alerts for insert with check (true);
create policy "public delete saved_alerts" on public.saved_alerts for delete using (true);

create policy "public read user_feedback" on public.user_feedback for select using (true);
create policy "public insert user_feedback" on public.user_feedback for insert with check (true);

create policy "public read project_logs" on public.project_logs for select using (true);
create policy "public insert project_logs" on public.project_logs for insert with check (true);
