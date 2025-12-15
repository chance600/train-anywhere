-- Add is_public column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT true;

-- Update Leaderboard Query Policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( is_public = true OR auth.uid() = id );

-- ANONYMOUS WORKOUTS TABLE (Guest Analytics)
create table if not exists public.anonymous_workouts (
  id uuid default gen_random_uuid() primary key,
  exercise text not null,
  reps integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.anonymous_workouts enable row level security;

-- Policies
create policy "Anyone can insert anonymous workouts."
  on public.anonymous_workouts for insert
  with check ( true );
