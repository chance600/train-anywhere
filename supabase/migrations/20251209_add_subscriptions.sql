-- Migration: Add Subscription Fields to Profiles

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_status TEXT CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Index for faster lookups on status
CREATE INDEX IF NOT EXISTS idx_profiles_is_pro ON profiles(is_pro);
