-- U++ Academy — FIX: infinite recursion in profiles RLS (ERROR 42P17)
-- Run in Supabase SQL Editor if profile reads ever fail again.
-- The old "Admins can read/update all profiles" policies checked admin role
-- with EXISTS (select from profiles) inside a profiles policy — a policy
-- querying itself. Replace them with a SECURITY DEFINER helper.
create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can read all profiles" on public.profiles for select using (public.is_admin());
create policy "Admins can update all profiles" on public.profiles for update using (public.is_admin());
