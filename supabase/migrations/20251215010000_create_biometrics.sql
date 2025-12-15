-- 1. Daily Biometrics Table
create table if not exists daily_biometrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  date date not null default CURRENT_DATE,
  sleep_score int check (sleep_score between 0 and 100),
  hrv_ms int, -- Heart Rate Variability (ms)
  resting_hr int, -- Resting Heart Rate (bpm)
  active_energy_kcal int, 
  source text default 'manual', -- 'apple_health', 'oura', 'manual'
  readiness_score int check (readiness_score between 0 and 100), -- 0-100 Score
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

-- RLS
alter table daily_biometrics enable row level security;

create policy "Users can view own biometrics"
  on daily_biometrics for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own biometrics"
  on daily_biometrics for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own biometrics"
  on daily_biometrics for update
  to authenticated
  using (auth.uid() = user_id);

-- 2. Readiness Calculation Function
-- Simple Heuristic for MVP: 
-- Readiness = (Sleep * 0.5) + (Inverse RHR * 0.5)
-- We assume RHR of 40 is "100%" and 100 is "0%" for the sake of normalization roughly.
-- Actual logic: 100 - (RHR - 40) * 1.5 (clamped)
create or replace function calculate_readiness()
returns trigger
language plpgsql
as $$
declare
  rhr_component float;
  sleep_component float;
  calc_score int;
begin
  -- Defaults
  if new.sleep_score is null then
    sleep_component := 50; -- Neutral if missing
  else
    sleep_component := new.sleep_score;
  end if;

  if new.resting_hr is null then
    rhr_component := 50;
  else
    -- Simple normalization: Lower RHR is better. 
    -- 40bpm -> 100 score, 80bpm -> 40 score.
    -- Formula: 100 - (rhr - 40) * 1.5
    rhr_component := 100 - ((new.resting_hr - 40) * 1.5);
    
    -- Clamp RHR component
    if rhr_component > 100 then rhr_component := 100; end if;
    if rhr_component < 0 then rhr_component := 0; end if;
  end if;

  -- Weighted Average (50/50 for now)
  calc_score := (sleep_component * 0.5) + (rhr_component * 0.5);

  new.readiness_score := calc_score;
  return new;
end;
$$;

-- 3. Trigger
create trigger biometrics_readiness_trigger
before insert or update on daily_biometrics
for each row
execute function calculate_readiness();
