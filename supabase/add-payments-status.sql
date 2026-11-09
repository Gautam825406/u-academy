-- U++ Academy — widen payments.status to cover the full payment lifecycle
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- The payments.status check was created inline (unnamed) in schema.sql /
-- add-cashfree.sql as check (status in ('created','paid','failed')), so
-- there is no fixed constraint name to DROP. This block looks the real
-- constraint name up in pg_constraint and replaces it.
-- New allowed values: created, pending, paid, successful, failed, refunded.

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.payments'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%created%'
    and pg_get_constraintdef(oid) like '%paid%'
  limit 1;
  if cname is not null then
    execute format('alter table public.payments drop constraint %I', cname);
  end if;
  -- Drop any stale copy of the new constraint first (re-run safety), then add.
  alter table public.payments drop constraint if exists payments_status_check;
  alter table public.payments
    add constraint payments_status_check
    check (status in ('created','pending','paid','successful','failed','refunded'));
end $$;

-- Verify: the constraint now lists all six statuses.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.payments'::regclass and contype = 'c';
