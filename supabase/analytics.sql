-- ANONYMOUS WORKOUTS TABLE (Guest Analytics)
create table public.anonymous_workouts (
  id uuid default gen_random_uuid() primary key,
  exercise text not null,
  reps integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.anonymous_workouts enable row level security;

-- Policies
-- 1. Allow Anyone (Anon) to INSERT
create policy "Anyone can insert anonymous workouts."
  on public.anonymous_workouts for insert
  with check ( true );

-- 2. Allow Service Role (Admin) to SELECT/ALL
-- (No policy needed for service_role as it bypasses RLS, but we explicitly disallow anon select by NOT creating a select policy for them)
-- So standard users/anon cannot see this data. Only the dashboard admin (you).
