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
