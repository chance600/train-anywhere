-- Add is_public column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_public boolean DEFAULT true;

-- Update Leaderboard Query Policy
-- We need to ensure that specific standard queries only return public profiles
-- But users should always be able to see themselves.

-- Drop existing "Public profiles are viewable by everyone" policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- Create new policy
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( is_public = true OR auth.uid() = id );
