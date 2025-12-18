-- Create analysis_logs table for storing AI Coach Critiques
create table if not exists public.analysis_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  media_type text not null, -- 'image' or 'video'
  analysis_content text not null, -- The Markdown critique from Gemini
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.analysis_logs enable row level security;

-- Policies
create policy "Users can view their own analysis logs"
  on public.analysis_logs for select
  using ( auth.uid() = user_id );

create policy "Users can insert their own analysis logs"
  on public.analysis_logs for insert
  with check ( auth.uid() = user_id );
