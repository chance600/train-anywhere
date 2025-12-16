-- Force update of Challenges RLS policy
-- This addresses potential issues where the policy wasn't applied or is stale

drop policy if exists "View public or own challenges" on challenges;

create policy "View public or own challenges"
  on challenges for select
  to authenticated
  using (
    is_public = true 
    OR creator_id = auth.uid()
    OR exists (
      select 1 from challenge_participants 
      where challenge_id = id AND user_id = auth.uid()
    )
  );
