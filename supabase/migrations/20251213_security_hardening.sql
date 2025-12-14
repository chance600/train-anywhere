-- SECURITY HARDENING 2025-12-13
-- Goal: Restrict workout visibility to owners only and enable full CRUD.

-- 1. WORKOUTS: Drop permissive "viewable by everyone" policy
DROP POLICY IF EXISTS "Workouts are viewable by everyone." ON public.workouts;

-- 2. WORKOUTS: Create restrictive "view own" policy
CREATE POLICY "Users can view own workouts"
ON public.workouts FOR SELECT
USING ( auth.uid() = user_id );

-- 3. WORKOUTS: Add Update policy
CREATE POLICY "Users can update own workouts"
ON public.workouts FOR UPDATE
USING ( auth.uid() = user_id );

-- 4. WORKOUTS: Add Delete policy
CREATE POLICY "Users can delete own workouts"
ON public.workouts FOR DELETE
USING ( auth.uid() = user_id );

-- 5. PROFILES: Ensure secure updates (Already exists, but good to verify)
-- Existing: "Users can update own profile." checks auth.uid() = id.

-- 6. BADGES: Keep public for social proof/leaderboards, but restricted write?
-- Existing: No INSERT policy for logic? 
-- The "earn_badge" function is SECURITY DEFINER, so it bypasses RLS to insert. 
-- This is correct. No user should be able to manually insert badges via API.

-- 7. ENABLE RLS (Redundant if already enabled, but safe)
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
