-- Existing shelving remains a sales/picking shelf. New shelving is reserve stock
-- until explicitly marked as a picking shelf.
alter table public.dir_rack_locations
  add column if not exists is_picking_shelf boolean;

update public.dir_rack_locations
set is_picking_shelf = upper(btrim(location_type)) = 'SHELVING'
where is_picking_shelf is null;

alter table public.dir_rack_locations
  alter column is_picking_shelf set default false,
  alter column is_picking_shelf set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.dir_rack_locations'::regclass
      and conname = 'dir_rack_locations_picking_shelf_type_check'
  ) then
    alter table public.dir_rack_locations
      add constraint dir_rack_locations_picking_shelf_type_check
      check (not is_picking_shelf or upper(btrim(location_type)) = 'SHELVING');
  end if;
end;
$$;

comment on column public.dir_rack_locations.is_picking_shelf is
  'True for shelving used by direct picking, sales uploads, and automatic shelf returns. False shelving is reserve stock and follows pallet-like stock flows.';
