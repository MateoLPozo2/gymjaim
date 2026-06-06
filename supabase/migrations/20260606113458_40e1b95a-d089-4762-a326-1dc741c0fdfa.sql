
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  target_col text not null,
  y_col text not null,
  condition_col text,
  difficulty public.exercise_difficulty not null default 'easy',
  visibility public.exercise_visibility not null default 'public',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.exercises to authenticated;
grant all on public.exercises to service_role;
alter table public.exercises enable row level security;
create policy "exercises_read" on public.exercises for select to authenticated using (visibility = 'public' or author_id = auth.uid());
create policy "exercises_insert_own" on public.exercises for insert to authenticated with check (author_id = auth.uid());
create policy "exercises_update_own" on public.exercises for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "exercises_delete_own" on public.exercises for delete to authenticated using (author_id = auth.uid());
create index exercises_author_idx on public.exercises(author_id);
create index exercises_visibility_idx on public.exercises(visibility);
