-- Add missing notification columns (if table exists from partial migration)
-- This is an idempotent update migration

DO $$
BEGIN
  -- Add streak_reminders if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'streak_reminders') THEN
    ALTER TABLE notification_preferences ADD COLUMN streak_reminders boolean default true;
  END IF;

  -- Add challenge_reminders if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'challenge_reminders') THEN
    ALTER TABLE notification_preferences ADD COLUMN challenge_reminders boolean default true;
  END IF;

  -- Add DND columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'dnd_start_time') THEN
    ALTER TABLE notification_preferences ADD COLUMN dnd_start_time time default '22:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'dnd_end_time') THEN
    ALTER TABLE notification_preferences ADD COLUMN dnd_end_time time default '08:00';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'quiet_days') THEN
    ALTER TABLE notification_preferences ADD COLUMN quiet_days text[] default '{}';
  END IF;

  -- Add rate limiting columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'max_notifications_per_day') THEN
    ALTER TABLE notification_preferences ADD COLUMN max_notifications_per_day int default 2;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'min_hours_between_notifications') THEN
    ALTER TABLE notification_preferences ADD COLUMN min_hours_between_notifications int default 4;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'last_notification_at') THEN
    ALTER TABLE notification_preferences ADD COLUMN last_notification_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'notifications_today') THEN
    ALTER TABLE notification_preferences ADD COLUMN notifications_today int default 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notification_preferences' AND column_name = 'notification_style') THEN
    ALTER TABLE notification_preferences ADD COLUMN notification_style text default 'friendly';
  END IF;
END $$;
