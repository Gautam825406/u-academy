-- U++ Academy — FIX: create missing profile rows for existing logins
-- Run in Supabase Dashboard > SQL Editor. Runs as postgres, bypasses RLS.
-- The register page bug: signUp creates the auth login, but the client-side
-- profiles insert can fail (no session yet / RLS), leaving a login with no
-- profile row, so /dashboard shows "No profile found".
-- This creates an Admin profile for BOTH emails the user registered with
-- (both belong to the same person, Gautam Keshri). Use
-- keshrigautam825406@gmail.com as the main Super Admin; the other can be
-- deleted later in Dashboard > Users if not needed.

insert into public.profiles (id, full_name, email, mobile, role, institute_name, city)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', 'Gautam Keshri'),
  u.email,
  '9065792628',
  'admin',
  'U++ Academy',
  'Hazaribagh'
from auth.users u
where u.email in ('keshrigautam825406@gmail.com', 'keshrigautam620@gmail.com')
on conflict (id) do update set
  full_name = excluded.full_name,
  email = excluded.email,
  mobile = excluded.mobile,
  role = 'admin',
  institute_name = excluded.institute_name,
  city = excluded.city;

-- Verify:
select id, full_name, email, mobile, role, institute_name, city, created_at
from public.profiles
order by created_at;
