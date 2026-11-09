-- U++ Academy — ADD batch description + thumbnail
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- 1) Adds description + thumbnail_url columns to batches.
-- 2) Creates a public Storage bucket 'batch-thumbnails' (max 5 MB, images only)
--    for Admin-uploaded batch cover images.
-- 3) Storage policies: anyone can read thumbnails; only signed-in users
--    can upload / replace / delete files in this bucket.

alter table public.batches
  add column if not exists description text,
  add column if not exists thumbnail_url text;

-- Storage bucket (guarded: storage schema is present on Supabase projects;
-- if it ever is not, the notice is raised and the column changes above stay).
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('batch-thumbnails', 'batch-thumbnails', true, 5242880,
          array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
exception when undefined_table then
  raise notice 'storage.buckets not available — create the batch-thumbnails bucket manually in Supabase > Storage.';
end $$;

-- Storage policies (idempotent: created only if a policy of that name
-- does not already exist on storage.objects).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'batch-thumbnails public read') then
    create policy "batch-thumbnails public read" on storage.objects
      for select using (bucket_id = 'batch-thumbnails');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'batch-thumbnails auth upload') then
    create policy "batch-thumbnails auth upload" on storage.objects
      for insert with check (bucket_id = 'batch-thumbnails' and auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'batch-thumbnails auth update') then
    create policy "batch-thumbnails auth update" on storage.objects
      for update using (bucket_id = 'batch-thumbnails' and auth.role() = 'authenticated')
      with check (bucket_id = 'batch-thumbnails' and auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'batch-thumbnails auth delete') then
    create policy "batch-thumbnails auth delete" on storage.objects
      for delete using (bucket_id = 'batch-thumbnails' and auth.role() = 'authenticated');
  end if;
end $$;

-- Verify: new columns + bucket exist.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'batches'
  and column_name in ('description', 'thumbnail_url');
select id, name, public, file_size_limit from storage.buckets where id = 'batch-thumbnails';
