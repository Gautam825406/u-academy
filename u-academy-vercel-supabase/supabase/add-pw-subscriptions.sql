-- U++ Academy — ADD Physics Wallah-style batch subscriptions (run on LIVE Supabase)
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- The live project already has all tables from schema.sql; this only adds
-- batch_plans + subscriptions, plan/validity columns on enrollments and
-- payments, and their RLS policies.

create table if not exists public.batch_plans (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  mrp numeric,
  duration_days int not null default 30,
  features text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  plan_id uuid references public.batch_plans(id) on delete set null,
  plan_name text,
  amount_paid numeric not null default 0,
  valid_from date not null default current_date,
  valid_until date,
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  order_id text,
  created_at timestamptz not null default now()
);

alter table public.enrollments add column if not exists plan_id uuid references public.batch_plans(id) on delete set null;
alter table public.enrollments add column if not exists valid_until date;
alter table public.enrollments add column if not exists subscription_status text not null default 'active' check (subscription_status in ('active','expired','cancelled'));
alter table public.payments add column if not exists plan_id uuid references public.batch_plans(id) on delete set null;

alter table public.batch_plans enable row level security;
alter table public.subscriptions enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['batch_plans','subscriptions']) loop
    execute format('drop policy if exists "auth read %I" on public.%I', t, t);
    execute format('drop policy if exists "auth write %I" on public.%I', t, t);
    execute format('drop policy if exists "auth update %I" on public.%I', t, t);
    execute format('drop policy if exists "auth delete %I" on public.%I', t, t);
    execute format('create policy "auth read %I" on public.%I for select using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth write %I" on public.%I for insert with check (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth update %I" on public.%I for update using (auth.role() = ''authenticated'')', t, t);
    execute format('create policy "auth delete %I" on public.%I for delete using (auth.role() = ''authenticated'')', t, t);
  end loop;
end $$;

create index if not exists idx_batch_plans_batch on public.batch_plans(batch_id);
create index if not exists idx_subscriptions_student on public.subscriptions(student_id);
create index if not exists idx_subscriptions_batch on public.subscriptions(batch_id);
create index if not exists idx_subscriptions_valid on public.subscriptions(valid_until);

-- Verify: new tables exist (counts start at 0).
select 'batch_plans' as table_name, count(*) from public.batch_plans
union all select 'subscriptions', count(*) from public.subscriptions;
