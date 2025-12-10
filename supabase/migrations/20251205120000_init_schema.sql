-- PROFILES TABLE
create table public.profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  avatar_url text,
  total_reps integer default 0,
  total_workouts integer default 0,
  tier text default 'Bronze',
  updated_at timestamp with time zone,
  
  constraint username_length check (char_length(username) >= 3)
);

alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- WORKOUTS TABLE
create table public.workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  exercise text not null,
  reps integer not null,
  score integer,
  duration_seconds integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.workouts enable row level security;

create policy "Workouts are viewable by everyone."
  on workouts for select
  using ( true );

create policy "Users can insert their own workouts."
  on workouts for insert
  with check ( auth.uid() = user_id );

-- BADGES TABLE
create table public.badges (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) not null,
  badge_type text not null,
  earned_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, badge_type)
);

alter table public.badges enable row level security;

create policy "Badges are viewable by everyone."
  on badges for select
  using ( true );

-- FN: HANDLE_NEW_USER
-- Automatically creates a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, total_reps, tier)
  values (new.id, split_part(new.email, '@', 1), 0, 'Bronze');
  return new;
end;
$$ language plpgsql security definer;

-- TRIGGER: ON AUTH.USERS
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- FN: UPDATE_PROFILE_STATS
-- Updates total_reps and total_workouts on new workout
create or replace function public.update_profile_stats()
returns trigger as $$
begin
  update public.profiles
  set 
    total_reps = total_reps + new.reps,
    total_workouts = total_workouts + 1,
    updated_at = now()
  where id = new.user_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_workout_created
  after insert on public.workouts
  for each row execute procedure public.update_profile_stats();
-- EARN_BADGE Function
-- Helper to safely award a badge if not already earned
create or replace function public.earn_badge(user_id uuid, badge_name text)
returns void as $$
begin
  insert into public.badges (user_id, badge_type, earned_at)
  values (user_id, badge_name, now())
  on conflict (user_id, badge_type) do nothing;
end;
$$ language plpgsql security definer;

-- CHECK_BADGES Trigger
-- Runs after every workout to check for new achievements
create or replace function public.check_badges()
returns trigger as $$
declare
  v_total_reps integer;
  v_total_workouts integer;
  v_max_score integer;
  v_streak integer;
begin
  -- Get Stats
  select total_reps, total_workouts into v_total_reps, v_total_workouts
  from public.profiles
  where id = new.user_id;

  -- 1. FIRST_WORKOUT
  if v_total_workouts >= 1 then
    perform public.earn_badge(new.user_id, 'First Step');
  end if;

  -- 2. FIVE_WORKOUTS
  if v_total_workouts >= 5 then
    perform public.earn_badge(new.user_id, 'High Five');
  end if;

  -- 3. 100_REPS
  if v_total_reps >= 100 then
    perform public.earn_badge(new.user_id, 'Centurion');
  end if;

  -- 4. 1000_REPS
  if v_total_reps >= 1000 then
    perform public.earn_badge(new.user_id, 'Kilo');
  end if;

  -- 5. PERFECT_FORM (Score 100)
  if new.score >= 100 then
    perform public.earn_badge(new.user_id, 'Perfectionist');
  end if;

  -- 6. EARLY_BIRD (Workout between 5AM and 8AM)
  -- Extract hour from created_at (which is UTC, so we might need timezone adjustment? simplified for now)
  -- Assuming server time or handling in logic. Let's do a simple check.
  -- if extract(hour from new.created_at) between 5 and 8 then
  --   perform public.earn_badge(new.user_id, 'Early Bird');
  -- end if;

  return new;
end;
$$ language plpgsql security definer;

-- Attach Trigger to Workouts
drop trigger if exists on_workout_check_badges on public.workouts;
create trigger on_workout_check_badges
  after insert on public.workouts
  for each row execute procedure public.check_badges();
