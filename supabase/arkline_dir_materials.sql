create extension if not exists pgcrypto;

create table if not exists public.arkline_dir_materials (
  id uuid primary key default gen_random_uuid(),
  material_name text not null unique,
  unit text not null default 'PCS',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_arkline_dir_materials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_dir_materials_set_updated_at on public.arkline_dir_materials;

create trigger arkline_dir_materials_set_updated_at
before update on public.arkline_dir_materials
for each row
execute function public.set_arkline_dir_materials_updated_at();

alter table public.arkline_dir_materials enable row level security;

drop policy if exists arkline_dir_materials_authenticated_select on public.arkline_dir_materials;
drop policy if exists arkline_dir_materials_authenticated_insert on public.arkline_dir_materials;
drop policy if exists arkline_dir_materials_authenticated_update on public.arkline_dir_materials;
drop policy if exists arkline_dir_materials_authenticated_delete on public.arkline_dir_materials;

create policy arkline_dir_materials_authenticated_select
on public.arkline_dir_materials
for select
to authenticated
using (true);

create policy arkline_dir_materials_authenticated_insert
on public.arkline_dir_materials
for insert
to authenticated
with check (true);

create policy arkline_dir_materials_authenticated_update
on public.arkline_dir_materials
for update
to authenticated
using (true)
with check (true);

create policy arkline_dir_materials_authenticated_delete
on public.arkline_dir_materials
for delete
to authenticated
using (true);
