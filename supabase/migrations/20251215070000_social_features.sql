-- Phase 10: The Tribe (Social Features)
-- Roles, Friends, Activity Feed, Challenges

-- ============================================
-- 1. ROLES & PERMISSIONS
-- ============================================

-- Add role to profiles
alter table profiles add column if not exists role text default 'athlete' 
  check (role in ('athlete', 'coach', 'admin'));

-- Add privacy level
alter table profiles add column if not exists privacy_level text default 'friends_only'
  check (privacy_level in ('public', 'friends_only', 'private'));

-- Add last_workout_at for reminder logic
alter table profiles add column if not exists last_workout_at timestamptz;

-- ============================================
-- 2. FRIENDSHIPS
-- ============================================

create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(requester_id, addressee_id),
  check (requester_id != addressee_id) -- Can't friend yourself
);

alter table friendships enable row level security;

-- Users can view friendships they're part of
create policy "View own friendships"
  on friendships for select using (
    auth.uid() = requester_id OR auth.uid() = addressee_id
  );

-- Users can send friend requests
create policy "Send friend requests"
  on friendships for insert with check (auth.uid() = requester_id);

-- Addressee can update status (accept/decline/block)
create policy "Manage incoming requests"
  on friendships for update using (auth.uid() = addressee_id);

-- Either party can delete (unfriend)
create policy "Unfriend"
  on friendships for delete using (
    auth.uid() = requester_id OR auth.uid() = addressee_id
  );

-- ============================================
-- 3. COACH-ATHLETE RELATIONSHIPS
-- ============================================

create table if not exists coach_athletes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references profiles(id) on delete cascade not null,
  athlete_id uuid references profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending', 'active', 'declined', 'ended')),
  notes text, -- Coach notes about athlete
  created_at timestamptz default now(),
  unique(coach_id, athlete_id),
  check (coach_id != athlete_id)
);

alter table coach_athletes enable row level security;

create policy "View coach-athlete relationships"
  on coach_athletes for select using (
    auth.uid() = coach_id OR auth.uid() = athlete_id
  );

create policy "Coaches can invite athletes"
  on coach_athletes for insert with check (auth.uid() = coach_id);

create policy "Athletes can respond to invites"
  on coach_athletes for update using (auth.uid() = athlete_id);

-- ============================================
-- 4. ACTIVITY FEED
-- ============================================

create table if not exists activity_feed (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  activity_type text not null check (activity_type in (
    'workout', 'badge', 'plan_started', 'plan_completed', 
    'challenge_joined', 'challenge_won', 'streak', 'milestone'
  )),
  content jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Index for efficient feed queries
create index if not exists idx_activity_feed_user_date on activity_feed(user_id, created_at desc);

alter table activity_feed enable row level security;

-- Activity visible based on privacy settings
create policy "View activity based on privacy"
  on activity_feed for select using (
    -- Own activity always visible
    auth.uid() = user_id
    OR
    -- Public profiles
    exists (select 1 from profiles where id = user_id AND privacy_level = 'public')
    OR
    -- Friends of friends_only profiles
    (
      exists (select 1 from profiles where id = user_id AND privacy_level = 'friends_only')
      AND exists (
        select 1 from friendships 
        where status = 'accepted' 
        AND (
          (requester_id = auth.uid() AND addressee_id = user_id)
          OR (addressee_id = auth.uid() AND requester_id = user_id)
        )
      )
    )
  );

-- Users can only insert their own activities (or trigger does it)
create policy "Insert own activity"
  on activity_feed for insert with check (auth.uid() = user_id);

-- Auto-log workout to activity feed
create or replace function log_workout_to_feed()
returns trigger as $$
begin
  insert into activity_feed (user_id, activity_type, content)
  values (
    new.user_id,
    'workout',
    jsonb_build_object(
      'exercise', new.exercise, 
      'reps', new.reps, 
      'score', coalesce(new.score, 0),
      'weight', coalesce(new.weight, 0)
    )
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_workout_activity_feed on workouts;
create trigger on_workout_activity_feed
  after insert on workouts
  for each row execute function log_workout_to_feed();

-- ============================================
-- 5. CHALLENGES
-- ============================================

create table if not exists challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references profiles(id) on delete cascade not null,
  name text not null check (char_length(name) between 3 and 100),
  description text,
  challenge_type text not null check (challenge_type in ('total_reps', 'total_workouts', 'specific_exercise', 'streak')),
  target_exercise text, -- For 'specific_exercise' type
  goal_value int, -- Target to beat (optional)
  start_date date not null,
  end_date date not null,
  is_public boolean default true,
  created_at timestamptz default now(),
  check (end_date > start_date)
);

-- Challenge Participants (create BEFORE policies that reference it)
create table if not exists challenge_participants (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid references challenges(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  score int default 0, -- Running score/progress
  rank int, -- Calculated periodically
  joined_at timestamptz default now(),
  unique(challenge_id, user_id)
);

-- Now enable RLS and create policies
alter table challenges enable row level security;

create policy "View public or own challenges"
  on challenges for select using (
    is_public = true 
    OR creator_id = auth.uid()
    OR exists (
      select 1 from challenge_participants 
      where challenge_id = id AND user_id = auth.uid()
    )
  );

create policy "Create challenges"
  on challenges for insert with check (auth.uid() = creator_id);

create policy "Manage own challenges"
  on challenges for update using (auth.uid() = creator_id);

alter table challenge_participants enable row level security;

create policy "View challenge participants"
  on challenge_participants for select using (
    exists (
      select 1 from challenges c 
      where c.id = challenge_id 
      AND (c.is_public = true OR c.creator_id = auth.uid())
    )
    OR user_id = auth.uid()
  );

create policy "Join challenges"
  on challenge_participants for insert with check (auth.uid() = user_id);

create policy "Leave challenges"
  on challenge_participants for delete using (auth.uid() = user_id);

-- ============================================
-- 6. HELPER FUNCTION: Check if users are friends
-- ============================================

create or replace function are_friends(user_a uuid, user_b uuid)
returns boolean as $$
begin
  return exists (
    select 1 from friendships 
    where status = 'accepted'
    AND (
      (requester_id = user_a AND addressee_id = user_b)
      OR (requester_id = user_b AND addressee_id = user_a)
    )
  );
end;
$$ language plpgsql security definer;
