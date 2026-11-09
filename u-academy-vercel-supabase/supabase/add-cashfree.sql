-- U++ Academy — ADD Cashfree pay-and-enrol (run on the LIVE Supabase project)
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- The live project already has all tables from schema.sql; this only adds
-- price/capacity/status columns on batches, plus the payments table.
-- Cashfree keys are NOT in this file — they go in Vercel env vars
-- (CASHFREE_APP_ID / CASHFREE_SECRET_KEY / CASHFREE_ENV).

alter table public.batches add column if not exists price numeric not null default 0;
alter table public.batches add column if not exists capacity int;
alter table public.batches add column if not exists status text not null default 'active' check (status in ('active','closed','upcoming'));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  batch_id uuid references public.batches(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  amount numeric not null, currency text not null default 'INR',
  order_id text not null unique, payment_session_id text,
  cf_payment_id text,
  status text not null default 'created' check (status in ('created','paid','failed')),
  payment_mode text,
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

do $$
begin
  drop policy if exists "auth read payments" on public.payments;
  drop policy if exists "auth write payments" on public.payments;
  drop policy if exists "auth update payments" on public.payments;
  drop policy if exists "auth delete payments" on public.payments;
  create policy "auth read payments" on public.payments for select using (auth.role() = 'authenticated');
  create policy "auth write payments" on public.payments for insert with check (auth.role() = 'authenticated');
  create policy "auth update payments" on public.payments for update using (auth.role() = 'authenticated');
  create policy "auth delete payments" on public.payments for delete using (auth.role() = 'authenticated');
end $$;

create index if not exists idx_payments_order on public.payments(order_id);
create index if not exists idx_payments_student on public.payments(student_id);
create index if not exists idx_payments_batch on public.payments(batch_id);

-- Verify: payments table exists (starts empty).
select 'payments' as table_name, count(*) from public.payments;
