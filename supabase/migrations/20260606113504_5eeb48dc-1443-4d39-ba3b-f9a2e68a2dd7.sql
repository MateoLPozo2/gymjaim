
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  seed bigint not null,
  code text,
  user_slope double precision,
  expected_slope double precision,
  optimal_slope double precision,
  slope_delta double precision,
  matched_oracle boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.attempts to authenticated;
grant all on public.attempts to service_role;
alter table public.attempts enable row level security;
create policy "attempts_read_own" on public.attempts for select to authenticated using (user_id = auth.uid());
create policy "attempts_insert_own" on public.attempts for insert to authenticated with check (user_id = auth.uid());
create index attempts_user_idx on public.attempts(user_id, created_at desc);
create index attempts_exercise_idx on public.attempts(exercise_id);

create table public.review_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  seed bigint not null,
  due_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.review_queue to authenticated;
grant all on public.review_queue to service_role;
alter table public.review_queue enable row level security;
create policy "review_queue_read_own" on public.review_queue for select to authenticated using (user_id = auth.uid());
create policy "review_queue_insert_own" on public.review_queue for insert to authenticated with check (user_id = auth.uid());
create policy "review_queue_update_own" on public.review_queue for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create index review_queue_due_idx on public.review_queue(due_at) where sent_at is null;
