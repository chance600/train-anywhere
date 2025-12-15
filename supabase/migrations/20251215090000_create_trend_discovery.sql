-- Phase 10.5: Trend Discovery Engine
-- Repository for AI-discovered workout trends

create table if not exists trend_repository (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null check (category in ('Cardio', 'Strength', 'Mobility', 'Holistic', 'HIIT', 'Challenge')),
  viral_score integer default 50 check (viral_score between 0 and 100), -- AI prediction of engagement
  source_platform text default 'General', -- TikTok, Instagram, etc.
  status text default 'discovered' check (status in ('discovered', 'approved', 'rejected', 'active')),
  
  -- Metadata for converting to a real challenge
  suggested_duration_days integer default 30,
  suggested_win_condition text, -- JSON string or description
  
  created_at timestamptz default now(),
  deployed_at timestamptz -- When it was converted to a real challenge
);

-- RLS
alter table trend_repository enable row level security;

-- Only admins should see this, but for this app we'll allow authenticated users for now
create policy "Authenticated users can view trends"
  on trend_repository for select
  to authenticated
  using (true);

create policy "Authenticated users can insert trends"
  on trend_repository for insert
  to authenticated
  with check (true);
  
create policy "Authenticated users can update trends"
  on trend_repository for update
  to authenticated
  using (true);
