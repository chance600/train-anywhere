create table if not exists ai_usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  date date default current_date not null,
  scan_count int default 0,
  unique(user_id, date)
);

alter table ai_usage enable row level security;

-- Only Service Role can insert/update (Edge Function)
create policy "Service Role can manage usage"
  on ai_usage
  for all
  to service_role
  using (true)
  with check (true);

-- Users can view their own usage (for future UI)
create policy "Users can view own usage"
  on ai_usage
  for select
  to authenticated
  using (auth.uid() = user_id);
