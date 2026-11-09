-- U++ Academy — ADD doubt forum (questions, threaded answers, votes)
-- Run in Supabase Dashboard > SQL Editor. Idempotent: safe to run more than once.
-- Extends the simple `doubts` table from schema.sql with a full forum:
-- students post questions (optionally on a batch), teachers/students reply
-- in threads, answers can be up/down-voted and marked accepted.

create table if not exists public.doubt_questions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  student_name text,
  batch_id uuid references public.batches(id) on delete set null,
  subject text,
  title text not null,
  body text,
  image_url text,
  status text not null default 'open' check (status in ('open','answered','resolved')),
  created_at timestamptz not null default now()
);
create table if not exists public.doubt_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.doubt_questions(id) on delete cascade,
  author_id uuid references public.profiles(id),
  author_name text,
  author_role text,
  body text not null,
  parent_answer_id uuid references public.doubt_answers(id) on delete cascade,
  is_accepted boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.doubt_votes (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.doubt_answers(id) on delete cascade,
  user_id uuid references public.profiles(id),
  vote int not null default 1 check (vote in (1, -1)),
  created_at timestamptz not null default now(),
  unique (answer_id, user_id)
);

-- RLS: same permissive-authenticated pattern as schema.sql
-- (RLS enabled; refine per-row / per-batch in production if needed).
alter table public.doubt_questions enable row level security;
alter table public.doubt_answers enable row level security;
alter table public.doubt_votes enable row level security;

do $$
declare t text;
begin
  for t in select unnest(array['doubt_questions','doubt_answers','doubt_votes']) loop
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

create index if not exists idx_doubt_questions_batch on public.doubt_questions(batch_id);
create index if not exists idx_doubt_questions_student on public.doubt_questions(student_id);
create index if not exists idx_doubt_questions_status on public.doubt_questions(status);
create index if not exists idx_doubt_questions_created on public.doubt_questions(created_at);
create index if not exists idx_doubt_answers_question on public.doubt_answers(question_id);
create index if not exists idx_doubt_answers_parent on public.doubt_answers(parent_answer_id);
create index if not exists idx_doubt_answers_author on public.doubt_answers(author_id);
create index if not exists idx_doubt_votes_answer on public.doubt_votes(answer_id);
create index if not exists idx_doubt_votes_user on public.doubt_votes(user_id);

-- Verify: new tables exist (counts start at 0).
select 'doubt_questions' as table_name, count(*) from public.doubt_questions
union all select 'doubt_answers', count(*) from public.doubt_answers
union all select 'doubt_votes', count(*) from public.doubt_votes;
