-- U++ Academy — FIX: auto-create profile on signup (prevents "No profile found")
-- Run in Supabase Dashboard > SQL Editor AFTER running fix-admin-profiles.sql.
-- Creates a SECURITY DEFINER trigger on auth.users: whenever a new auth user
-- is created, a matching public.profiles row is inserted from the signUp
-- metadata (full_name, mobile, role, class_label, board, subject, child
-- name/id, institute_name, city). If profiles already has 0 rows, the new
-- user becomes admin; otherwise they keep the role they chose.
-- This makes profile creation server-side, so it cannot fail because the
-- browser client had no session yet / RLS blocked the client insert.
-- The register page in the app must also pass these fields as user_metadata
-- in supabase.auth.signUp({ options: { data: {...} } }) — see the fixed
-- src/app/auth/register/page.tsx in the repo.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
  chosen_role text;
begin
  select count(*) = 0 into is_first from public.profiles;
  chosen_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');
  if is_first then chosen_role := 'admin'; end if;
  insert into public.profiles (
    id, full_name, email, mobile, role,
    class_label, board, subject, child_name, child_student_id,
    institute_name, city
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', 'New User'),
    new.email,
    new.raw_user_meta_data ->> 'mobile',
    chosen_role,
    new.raw_user_meta_data ->> 'class_label',
    new.raw_user_meta_data ->> 'board',
    new.raw_user_meta_data ->> 'subject',
    new.raw_user_meta_data ->> 'child_name',
    new.raw_user_meta_data ->> 'child_student_id',
    new.raw_user_meta_data ->> 'institute_name',
    new.raw_user_meta_data ->> 'city'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
