-- Phase 9.4: Notification Preferences
-- Supports workout logging reminders with granular user control

create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null unique,
  
  -- Master toggle
  enabled boolean default true,
  
  -- Reminder Types (granular control)
  inactivity_reminders boolean default true,
  plan_reminders boolean default true,
  daily_log_reminders boolean default true,
  streak_reminders boolean default true,
  challenge_reminders boolean default true,
  
  -- Anti-Disturbance Controls
  preferred_reminder_time time default '20:00', -- Evening default
  timezone text default 'America/New_York',
  inactive_days_threshold int default 2 check (inactive_days_threshold between 1 and 14),
  
  -- Do Not Disturb
  dnd_start_time time default '22:00', -- No notifications after 10pm
  dnd_end_time time default '08:00', -- Until 8am
  quiet_days text[] default '{}', -- e.g., ['Sunday'] - no notifications on rest days
  
  -- Rate Limiting
  max_notifications_per_day int default 2 check (max_notifications_per_day between 1 and 5),
  min_hours_between_notifications int default 4 check (min_hours_between_notifications between 1 and 24),
  last_notification_at timestamptz, -- Track for cooldown
  notifications_today int default 0, -- Reset daily
  
  -- Web Push subscription (stored as JSON)
  push_subscription jsonb,
  
  -- Location-based (for future geofencing)
  gym_locations jsonb, -- Array of {lat, lng, name} for geofence triggers
  location_reminders_enabled boolean default false,
  
  -- User preferences for message style
  notification_style text default 'friendly' check (notification_style in ('friendly', 'motivational', 'minimal')),
  
  -- Metadata
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: Users can only manage their own preferences
alter table notification_preferences enable row level security;

create policy "Users manage own notification preferences"
  on notification_preferences for all using (auth.uid() = user_id);

-- Auto-create preferences when user signs up
create or replace function create_notification_preferences()
returns trigger as $$
begin
  insert into notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Attach to profile creation (which happens on user signup)
drop trigger if exists on_profile_create_notification_prefs on profiles;
create trigger on_profile_create_notification_prefs
  after insert on profiles
  for each row execute function create_notification_preferences();
