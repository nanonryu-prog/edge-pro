-- EDGE Pro — database schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.

-- 1) Per-user journal data (cloud sync) + current plan
create table if not exists public.journals (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,   -- trades, playbooks, journal, goals, etc.
  plan       text default 'trial',                  -- set by the Stripe webhook
  updated_at timestamptz default now()
);

alter table public.journals enable row level security;

-- Each user can only read/write their own row
drop policy if exists "own journal" on public.journals;
create policy "own journal" on public.journals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) Called by the Stripe webhook (service role) to set a user's plan by email.
--    SECURITY DEFINER so it can look up auth.users and upsert the plan.
create or replace function public.set_plan_by_email(p_email text, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid;
begin
  select id into uid from auth.users where email = p_email limit 1;
  if uid is not null then
    insert into public.journals(user_id, plan) values (uid, p_plan)
    on conflict (user_id) do update set plan = excluded.plan, updated_at = now();
  end if;
end;
$$;

-- 3) Creator / affiliate promo codes (one per creator email)
create table if not exists public.creators (
  email      text primary key,
  code       text unique not null,
  created_at timestamptz default now()
);
alter table public.creators enable row level security;
drop policy if exists "own creator row" on public.creators;
create policy "own creator row" on public.creators
  for all
  using (auth.jwt() ->> 'email' = email)
  with check (auth.jwt() ->> 'email' = email);
