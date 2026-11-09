-- U++ Academy — FIX: create a profile for EVERY auth login that has none
-- Run in Supabase Dashboard > SQL Editor. Runs as postgres, bypasses RLS.
-- This is the deterministic fix for "No profile found": the client-side
-- self-heal in the dashboard can still fail under RLS, so create the rows
-- directly in the database for every auth user missing a profile.
-- Gautam's two emails become Admin; any other existing login keeps the
-- role from its signup metadata, or 'student' by default.

insert into public.profiles (id, full_name, email, mobile, role, institute_name, city)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(u.email, '@', 1)),
  u.email,
  coalesce(u.raw_user_meta_data ->> 'mobile', ''),
  case
    when u.email in ('keshrigautam825406@gmail.com', 'keshrigautam620@gmail.com') then 'admin'
    when coalesce(u.raw_user_meta_data ->> 'role', '') in ('student','teacher','parent','admin')
      then u.raw_user_meta_data ->> 'role'
    else 'student'
  end,
  coalesce(u.raw_user_meta_data ->> 'institute_name', 'U++ Academy'),
  coalesce(u.raw_user_meta_data ->> 'city', 'Hazaribagh')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- Verify — every login should now have exactly one profile:
select u.email as auth_email, p.full_name, p.role, p.institute_name
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;
