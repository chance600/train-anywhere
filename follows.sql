-- FOLLOWS Table: Track who follows whom
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

-- Enable RLS
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see all follows
CREATE POLICY "Follows are viewable by everyone" ON public.follows
  FOR SELECT USING (true);

-- Policy: Users can follow/unfollow
CREATE POLICY "Users can manage their follows" ON public.follows
  FOR ALL USING (auth.uid() = follower_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_follows_follower ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON public.follows(following_id);
