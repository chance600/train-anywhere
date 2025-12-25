-- Add JSONB column for flexible user goals
alter table public.profiles
add column if not exists fitness_goals jsonb default '{}'::jsonb;

-- Comment on column
comment on column public.profiles.fitness_goals is 'Stores target_goal (Muscle Gain, etc), equipment availability, and schedule preferences.';

-- Example structure:
-- {
--   "goal": "Muscle Gain",
--   "equipment": ["Dumbbells", "Bench"],
--   "days_per_week": 4,
--   "experience": "Intermediate"
-- }
