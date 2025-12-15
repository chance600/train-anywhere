-- 1. User Agreements Table
create table if not exists user_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  document_version text not null, -- "v1.0"
  document_type text not null, -- "liability_waiver"
  signed_at timestamptz default now(),
  ip_address text,
  user_agent text
);

-- RLS
alter table user_agreements enable row level security;

create policy "Users can view own agreements"
  on user_agreements for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can sign agreements"
  on user_agreements for insert
  to authenticated
  with check (auth.uid() = user_id);

-- 2. Index for fast lookups
create index idx_user_agreements_user on user_agreements(user_id);
create index idx_user_agreements_type_version on user_agreements(document_type, document_version);
