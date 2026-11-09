-- U++ Academy — ADD batch demo lecture PDF
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- 1) Adds demo_pdf_url to batches — a free demo lecture PDF a student can
--    open BEFORE buying/enrolling (never gated behind a subscription).
-- 2) Creates a public Storage bucket 'batch-demo-pdfs' (max 10 MB, PDF only).
-- 3) Storage policies: anyone can read demo PDFs; only signed-in users
--    can upload / replace / delete files in this bucket.

alter table public.batches
  add column if not exists demo_pdf_url text;

do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('batch-demo-pdfs', 'batch-demo-pdfs', true, 10485760,
          array['application/pdf'])
  on conflict (id) do update set
    public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf'];
exception when undefined_table then
  raise notice 'storage.buckets not available — create the batch-demo-pdfs bucket manually in Supabase > Storage.';
end $$;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'batch-demo-pdfs public read') then
    create policy "batch-demo-pdfs public read" on storage.objects
      for select using (bucket_id = 'batch-demo-pdfs');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'batch-demo-pdfs auth upload') then
    create policy "batch-demo-pdfs auth upload" on storage.objects
      for insert with check (bucket_id = 'batch-demo-pdfs' and auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'batch-demo-pdfs auth update') then
    create policy "batch-demo-pdfs auth update" on storage.objects
      for update using (bucket_id = 'batch-demo-pdfs' and auth.role() = 'authenticated')
      with check (bucket_id = 'batch-demo-pdfs' and auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'batch-demo-pdfs auth delete') then
    create policy "batch-demo-pdfs auth delete" on storage.objects
      for delete using (bucket_id = 'batch-demo-pdfs' and auth.role() = 'authenticated');
  end if;
end $$;

-- Verify: new column + bucket exist.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'batches'
  and column_name = 'demo_pdf_url';
select id, name, public, file_size_limit from storage.buckets where id = 'batch-demo-pdfs';
