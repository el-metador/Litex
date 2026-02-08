-- LiteCode Supabase Full Schema (all migrations merged)
-- Apply in Supabase SQL Editor as a single script.

-- ============================================================
-- Migration: 20260206_litecode_core.sql
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.usage_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('chat', 'enhancer')),
  daily_limit integer not null check (daily_limit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature)
);

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('chat', 'enhancer')),
  request_id uuid not null,
  tokens integer not null default 0,
  model text not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id, feature)
);

create index if not exists usage_events_user_feature_created_at_idx
  on public.usage_events (user_id, feature, created_at desc);

create table if not exists public.billing_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credit_balance_usd numeric(12, 6) not null default 0,
  hard_limit_usd numeric(12, 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  feature text not null check (feature in ('chat', 'enhancer')),
  tokens integer not null default 0,
  amount_usd numeric(12, 6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists billing_ledger_user_created_at_idx
  on public.billing_ledger (user_id, created_at desc);

create table if not exists public.llm_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('chat', 'enhancer')),
  model text not null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'completed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists llm_jobs_status_created_at_idx
  on public.llm_jobs (status, created_at desc);

alter table public.profiles enable row level security;
alter table public.usage_limits enable row level security;
alter table public.usage_events enable row level security;
alter table public.billing_accounts enable row level security;
alter table public.billing_ledger enable row level security;
alter table public.llm_jobs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "usage_limits_select_own" on public.usage_limits;
create policy "usage_limits_select_own"
  on public.usage_limits
  for select
  using (auth.uid() = user_id);

drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own"
  on public.usage_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "billing_accounts_select_own" on public.billing_accounts;
create policy "billing_accounts_select_own"
  on public.billing_accounts
  for select
  using (auth.uid() = user_id);

drop policy if exists "billing_ledger_select_own" on public.billing_ledger;
create policy "billing_ledger_select_own"
  on public.billing_ledger
  for select
  using (auth.uid() = user_id);

drop policy if exists "llm_jobs_select_own" on public.llm_jobs;
create policy "llm_jobs_select_own"
  on public.llm_jobs
  for select
  using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('litecode-artifacts', 'litecode-artifacts', false)
on conflict (id) do nothing;

drop policy if exists "litecode_storage_select_own" on storage.objects;
create policy "litecode_storage_select_own"
  on storage.objects
  for select
  using (
    bucket_id = 'litecode-artifacts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "litecode_storage_insert_own" on storage.objects;
create policy "litecode_storage_insert_own"
  on storage.objects
  for insert
  with check (
    bucket_id = 'litecode-artifacts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "litecode_storage_update_own" on storage.objects;
create policy "litecode_storage_update_own"
  on storage.objects
  for update
  using (
    bucket_id = 'litecode-artifacts'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'litecode-artifacts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "litecode_storage_delete_own" on storage.objects;
create policy "litecode_storage_delete_own"
  on storage.objects
  for delete
  using (
    bucket_id = 'litecode-artifacts'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.billing_accounts (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- Migration: 20260208_chat_history.sql
-- ============================================================

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  seq integer not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (session_id, seq)
);

create index if not exists chat_sessions_user_last_message_idx
  on public.chat_sessions (user_id, last_message_at desc)
  where deleted_at is null;

create index if not exists chat_messages_session_seq_idx
  on public.chat_messages (session_id, seq);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own"
  on public.chat_sessions
  for select
  using (auth.uid() = user_id and deleted_at is null);

drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own"
  on public.chat_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "chat_sessions_update_own" on public.chat_sessions;
create policy "chat_sessions_update_own"
  on public.chat_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own"
  on public.chat_messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own"
  on public.chat_messages
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "chat_messages_update_own" on public.chat_messages;
create policy "chat_messages_update_own"
  on public.chat_messages
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own"
  on public.chat_messages
  for delete
  using (auth.uid() = user_id);
