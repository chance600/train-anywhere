-- 1. Workout Plans Table
create table if not exists workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null, -- "Summer Shred"
  description text,
  schedule jsonb not null, -- Stores the multi-week structure
  status text default 'active', -- 'active', 'completed', 'archived'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table workout_plans enable row level security;

create policy "Users can view own plans"
  on workout_plans for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own plans"
  on workout_plans for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own plans"
  on workout_plans for update
  to authenticated
  using (auth.uid() = user_id);

-- 2. Index for faster JSONB queries (optional but good for future)
create index idx_workout_plans_user on workout_plans(user_id);
create index idx_workout_plans_status on workout_plans(status);
