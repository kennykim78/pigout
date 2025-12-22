-- Create food_cache table for Smart Caching
create table if not exists public.food_cache (
  id uuid default gen_random_uuid() primary key,
  food_name text not null unique,
  nutrition_json jsonb, -- 영양 성분
  general_analysis_json jsonb, -- 일반적인 효능, 부작용 (사용자 무관)
  cooking_tips_json jsonb, -- 조리법
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for fast lookup
create index if not exists food_cache_name_idx on public.food_cache (food_name);

-- RLS Policies (Optional but good practice)
alter table public.food_cache enable row level security;

create policy "Enable read access for all users" on public.food_cache
  for select using (true);

create policy "Enable insert for authenticated users" on public.food_cache
  for insert with check (auth.role() = 'authenticated' or auth.role() = 'service_role');
