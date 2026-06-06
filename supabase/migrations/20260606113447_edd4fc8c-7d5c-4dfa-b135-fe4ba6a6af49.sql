
create table public.datasets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  storage_path text,
  builtin_key text,
  columns jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.datasets to authenticated;
grant all on public.datasets to service_role;
alter table public.datasets enable row level security;
create policy "datasets_read" on public.datasets for select to authenticated using (is_public or is_builtin or owner_id = auth.uid());
create policy "datasets_insert_own" on public.datasets for insert to authenticated with check (owner_id = auth.uid());
create policy "datasets_update_own" on public.datasets for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "datasets_delete_own" on public.datasets for delete to authenticated using (owner_id = auth.uid());
