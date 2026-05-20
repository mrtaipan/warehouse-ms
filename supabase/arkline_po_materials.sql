create extension if not exists pgcrypto;

create table if not exists public.arkline_po_materials (
  id uuid primary key default gen_random_uuid(),
  po_id text not null,
  arkline_po_item_id uuid not null references public.arkline_po_items(id) on update cascade on delete cascade,
  sku_induk text not null,
  material_id uuid not null references public.arkline_dir_materials(id) on update cascade on delete restrict,
  material_name_snapshot text not null,
  size_variant text null,
  color_variant text null,
  unit text not null default 'PCS',
  generated_qty numeric(14,2) not null default 0,
  final_qty numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists arkline_po_materials_unique_line_idx
  on public.arkline_po_materials (
    arkline_po_item_id,
    material_id,
    coalesce(size_variant, ''),
    coalesce(color_variant, '')
  );

create index if not exists arkline_po_materials_po_id_idx
  on public.arkline_po_materials (po_id);

create index if not exists arkline_po_materials_po_item_idx
  on public.arkline_po_materials (arkline_po_item_id);

create index if not exists arkline_po_materials_material_id_idx
  on public.arkline_po_materials (material_id);

create or replace function public.set_arkline_po_materials_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_po_materials_set_updated_at on public.arkline_po_materials;
create trigger arkline_po_materials_set_updated_at
before update on public.arkline_po_materials
for each row
execute function public.set_arkline_po_materials_updated_at();

alter table public.arkline_po_materials enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.arkline_po_materials to authenticated;

drop policy if exists arkline_po_materials_authenticated_select on public.arkline_po_materials;
drop policy if exists arkline_po_materials_authenticated_insert on public.arkline_po_materials;
drop policy if exists arkline_po_materials_authenticated_update on public.arkline_po_materials;
drop policy if exists arkline_po_materials_authenticated_delete on public.arkline_po_materials;

create policy arkline_po_materials_authenticated_select
on public.arkline_po_materials
for select
to authenticated
using (true);

create policy arkline_po_materials_authenticated_insert
on public.arkline_po_materials
for insert
to authenticated
with check (true);

create policy arkline_po_materials_authenticated_update
on public.arkline_po_materials
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_materials_authenticated_delete
on public.arkline_po_materials
for delete
to authenticated
using (true);
