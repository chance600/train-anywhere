-- Add weight and tempo tracking columns to workouts table
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS avg_rep_duration numeric; -- Seconds per rep (tempo)
