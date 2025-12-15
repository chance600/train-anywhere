-- Enable Extensions
create extension if not exists vector;
create extension if not exists "uuid-ossp";

-- 1. Standardized Exercises Table
create table if not exists exercises (
  id text primary key, -- Maps to ExerciseDB ID (e.g., "0001")
  name text not null,
  body_part text not null,
  equipment text,
  target text, -- Main muscle group
  secondary_muscles text[], -- Array of secondary muscles
  gif_url text,
  instructions text[], -- Step-by-step instructions
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add Full Text Search Column (Auto-updated)
alter table exercises add column if not exists search_vector tsvector 
generated always as (to_tsvector('english', name || ' ' || target || ' ' || body_part)) stored;

create index if not exists exercises_search_idx on exercises using gin (search_vector);

-- 2. Embeddings Table for Semantic Search
create table if not exists exercise_embeddings (
  id uuid primary key default gen_random_uuid(),
  exercise_id text references exercises(id) on delete cascade,
  embedding vector(768), -- Gemini Text Embedding Dimensions
  created_at timestamptz default now()
);

-- Index for faster vector similarity search (IVFFlat is good for ease, HNSW is better for performance but higher build cost)
-- We'll start without an index for small datasets (<10k), or add one later. 
-- For 10k rows, brute force is actually very fast in Postgres.

-- 3. RLS Policies
alter table exercises enable row level security;
alter table exercise_embeddings enable row level security;

-- Public can read exercises
create policy "Public exercises are viewable by everyone"
on exercises for select
to authenticated, anon
using (true);

-- Service role can manage exercises (Seed scripts)
create policy "Service role can manage exercises"
on exercises for all
to service_role
using (true)
with check (true);

create policy "Public embeddings are viewable by everyone"
on exercise_embeddings for select
to authenticated, anon
using (true);

create policy "Service role can manage embeddings"
on exercise_embeddings for all
to service_role
using (true)
with check (true);

-- 4. Vector Search RPC Function
create or replace function match_exercises (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id text,
  name text,
  body_part text,
  target text,
  equipment text,
  gif_url text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    exercises.id,
    exercises.name,
    exercises.body_part,
    exercises.target,
    exercises.equipment,
    exercises.gif_url,
    1 - (exercise_embeddings.embedding <=> query_embedding) as similarity
  from exercise_embeddings
  join exercises on exercises.id = exercise_embeddings.exercise_id
  where 1 - (exercise_embeddings.embedding <=> query_embedding) > match_threshold
  order by exercise_embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;
