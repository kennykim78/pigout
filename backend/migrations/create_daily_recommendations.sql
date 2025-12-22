-- Create daily_recommendations table
create table if not exists daily_recommendations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  date date not null,
  food_content jsonb,
  remedy_content jsonb,
  exercise_content jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, date)
);

-- RLS Policies
alter table daily_recommendations enable row level security;

create policy "Users can view their own recommendations"
  on daily_recommendations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own recommendations"
  on daily_recommendations for insert
  with check (auth.uid() = user_id);
