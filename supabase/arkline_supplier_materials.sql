create extension if not exists pgcrypto;

create table if not exists public.arkline_supplier_materials (
  id uuid primary key default gen_random_uuid(),
  supplier_id bigint not null references public.dir_suppliers(id) on update cascade on delete restrict,
  material_id uuid not null references public.arkline_dir_materials(id) on update cascade on delete restrict,
  notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_supplier_materials_supplier_material_uidx unique (supplier_id, material_id)
);

create index if not exists arkline_supplier_materials_supplier_id_idx
  on public.arkline_supplier_materials (supplier_id, is_active);

create index if not exists arkline_supplier_materials_material_id_idx
  on public.arkline_supplier_materials (material_id, is_active);

create or replace function public.set_arkline_supplier_materials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_supplier_materials_set_updated_at on public.arkline_supplier_materials;

create trigger arkline_supplier_materials_set_updated_at
before update on public.arkline_supplier_materials
for each row
execute function public.set_arkline_supplier_materials_updated_at();

alter table public.arkline_supplier_materials enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update on public.arkline_supplier_materials to authenticated;

drop policy if exists arkline_supplier_materials_authenticated_select on public.arkline_supplier_materials;
drop policy if exists arkline_supplier_materials_authenticated_insert on public.arkline_supplier_materials;
drop policy if exists arkline_supplier_materials_authenticated_update on public.arkline_supplier_materials;

create policy arkline_supplier_materials_authenticated_select
on public.arkline_supplier_materials
for select
to authenticated
using (true);

create policy arkline_supplier_materials_authenticated_insert
on public.arkline_supplier_materials
for insert
to authenticated
with check (true);

create policy arkline_supplier_materials_authenticated_update
on public.arkline_supplier_materials
for update
to authenticated
using (true)
with check (true);
