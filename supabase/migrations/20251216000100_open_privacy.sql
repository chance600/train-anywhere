-- Force update of Challenges RLS policy to allow ANON access
drop policy if exists "View public or own challenges" on challenges;

create policy "View public or own challenges"
  on challenges for select
  using (
    is_public = true 
    OR creator_id = auth.uid()
    OR exists (
      select 1 from challenge_participants 
      where challenge_id = id AND user_id = auth.uid()
    )
  );
