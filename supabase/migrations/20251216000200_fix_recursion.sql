-- Fix infinite recursion by simplifying Challenges policy
-- Removed dependency on challenge_participants table for read access
-- Users can see: Public challenges OR Challenges they created

drop policy if exists "View public or own challenges" on challenges;

create policy "View public or own challenges"
  on challenges for select
  using (
    is_public = true 
    OR creator_id = auth.uid()
  );
