create extension if not exists pgcrypto;

create table if not exists public.arkline_dir_bom (
  id uuid primary key default gen_random_uuid(),
  kategori_pengadaan text not null,
  sku_induk text null,
  material_id uuid not null references public.arkline_dir_materials(id) on update cascade on delete restrict,
  size_variant text null,
  color_variant text null,
  qty_per_1 numeric(14,4) not null default 0,
  waste_pct numeric(8,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arkline_dir_bom_kategori_pengadaan_idx
  on public.arkline_dir_bom (kategori_pengadaan, is_active);

create index if not exists arkline_dir_bom_sku_induk_idx
  on public.arkline_dir_bom (sku_induk, is_active);

create index if not exists arkline_dir_bom_material_id_idx
  on public.arkline_dir_bom (material_id);

create unique index if not exists arkline_dir_bom_unique_line_idx
  on public.arkline_dir_bom (
    kategori_pengadaan,
    coalesce(sku_induk, ''),
    material_id,
    coalesce(size_variant, ''),
    coalesce(color_variant, '')
  );

create or replace function public.set_arkline_dir_bom_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_dir_bom_set_updated_at on public.arkline_dir_bom;

create trigger arkline_dir_bom_set_updated_at
before update on public.arkline_dir_bom
for each row
execute function public.set_arkline_dir_bom_updated_at();

alter table public.arkline_dir_bom enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.arkline_dir_bom to authenticated;

drop policy if exists arkline_dir_bom_authenticated_select on public.arkline_dir_bom;
drop policy if exists arkline_dir_bom_authenticated_insert on public.arkline_dir_bom;
drop policy if exists arkline_dir_bom_authenticated_update on public.arkline_dir_bom;
drop policy if exists arkline_dir_bom_authenticated_delete on public.arkline_dir_bom;

create policy arkline_dir_bom_authenticated_select
on public.arkline_dir_bom
for select
to authenticated
using (true);

create policy arkline_dir_bom_authenticated_insert
on public.arkline_dir_bom
for insert
to authenticated
with check (true);

create policy arkline_dir_bom_authenticated_update
on public.arkline_dir_bom
for update
to authenticated
using (true)
with check (true);

create policy arkline_dir_bom_authenticated_delete
on public.arkline_dir_bom
for delete
to authenticated
using (true);
