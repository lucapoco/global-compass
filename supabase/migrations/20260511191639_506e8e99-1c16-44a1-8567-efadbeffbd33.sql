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

alter table public.saved_intelligence enable row level security;

create policy "public read saved_intelligence"   on public.saved_intelligence for select using (true);
create policy "public insert saved_intelligence" on public.saved_intelligence for insert with check (true);
create policy "public delete saved_intelligence" on public.saved_intelligence for delete using (true);