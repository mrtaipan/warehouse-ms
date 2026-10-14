-- Read model for Current Stock and Warehouse Map.
-- The base warehouse_storage rows remain unchanged for actions and audit history.

create or replace view public.warehouse_storage_current_stock
with (security_invoker = true)
as
select
  ws.rack_location_id,
  rl.location_type,
  rl.location_id,
  rl.location_code,
  rl.sub_location,
  rl.location_name,
  upper(nullif(trim(coalesce(rl.group_code, '')), '')) as group_code,
  nullif(trim(ws.source_variant_code), '') as source_variant_code,
  nullif(trim(ws.sku_id), '') as sku_id,
  nullif(trim(ws.item_name), '') as item_name,
  nullif(trim(ws.size), '') as size,
  ws.category_id,
  nullif(trim(ws.brand_code), '') as brand_code,
  sum(coalesce(ws.qty, 0)) as qty,
  count(*)::integer as source_row_count,
  array_agg(ws.id order by ws.id) as source_row_ids,
  min(ws.created_at) as created_at,
  max(ws.updated_at) as updated_at
from public.warehouse_storage ws
join public.dir_rack_locations rl on rl.id = ws.rack_location_id
where coalesce(ws.qty, 0) <> 0
   or (
     upper(trim(coalesce(rl.group_code, ''))) = 'ARKLINE'
     and upper(trim(coalesce(rl.location_type, ''))) = 'SHELVING'
   )
group by
  ws.rack_location_id,
  rl.location_type,
  rl.location_id,
  rl.location_code,
  rl.sub_location,
  rl.location_name,
  upper(nullif(trim(coalesce(rl.group_code, '')), '')),
  nullif(trim(ws.source_variant_code), ''),
  nullif(trim(ws.sku_id), ''),
  nullif(trim(ws.item_name), ''),
  nullif(trim(ws.size), ''),
  ws.category_id,
  nullif(trim(ws.brand_code), '');

comment on view public.warehouse_storage_current_stock is
  'Aggregated warehouse stock read model. source_row_ids preserves the base rows used by actions and audit history.';

grant select on public.warehouse_storage_current_stock to authenticated;

create or replace function public.cleanup_arkline_shelving_zero_duplicates()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  with ranked_rows as (
    select
      ws.id,
      row_number() over (
        partition by
          ws.rack_location_id,
          upper(regexp_replace(coalesce(ws.sku_id, ''), '[^A-Z0-9]', '', 'g')),
          upper(regexp_replace(coalesce(ws.source_variant_code, ''), '[^A-Z0-9]', '', 'g')),
          upper(trim(coalesce(ws.item_name, ''))),
          upper(trim(coalesce(ws.size, ''))),
          ws.category_id,
          upper(trim(coalesce(ws.brand_code, '')))
        order by ws.id
      ) as duplicate_rank
    from public.warehouse_storage ws
    join public.dir_rack_locations rl on rl.id = ws.rack_location_id
    where coalesce(ws.qty, 0) = 0
      and upper(trim(coalesce(rl.group_code, ''))) = 'ARKLINE'
      and upper(trim(coalesce(rl.location_type, ''))) = 'SHELVING'
  )
  delete from public.warehouse_storage ws
  using ranked_rows duplicates
  where ws.id = duplicates.id
    and duplicates.duplicate_rank > 1;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

comment on function public.cleanup_arkline_shelving_zero_duplicates() is
  'Removes duplicate zero-quantity Arkline shelving rows while preserving one row per location and item identity.';

-- Keep future zero-quantity duplicates from accumulating after inserts or stock updates.
create or replace function public.cleanup_arkline_shelving_zero_duplicates_trigger()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(new.qty, 0) = 0 then
    delete from public.warehouse_storage duplicate
    using public.dir_rack_locations rl
    where duplicate.rack_location_id = new.rack_location_id
      and rl.id = duplicate.rack_location_id
      and upper(trim(coalesce(rl.group_code, ''))) = 'ARKLINE'
      and upper(trim(coalesce(rl.location_type, ''))) = 'SHELVING'
      and coalesce(duplicate.qty, 0) = 0
      and duplicate.sku_id is not distinct from new.sku_id
      and duplicate.source_variant_code is not distinct from new.source_variant_code
      and duplicate.item_name is not distinct from new.item_name
      and duplicate.size is not distinct from new.size
      and duplicate.category_id is not distinct from new.category_id
      and duplicate.brand_code is not distinct from new.brand_code
      and duplicate.id <> (
        select min(keeper.id)
        from public.warehouse_storage keeper
        where keeper.rack_location_id = new.rack_location_id
          and coalesce(keeper.qty, 0) = 0
          and keeper.sku_id is not distinct from new.sku_id
          and keeper.source_variant_code is not distinct from new.source_variant_code
          and keeper.item_name is not distinct from new.item_name
          and keeper.size is not distinct from new.size
          and keeper.category_id is not distinct from new.category_id
          and keeper.brand_code is not distinct from new.brand_code
      );
  end if;

  return new;
end;
$$;

drop trigger if exists warehouse_storage_cleanup_arkline_zero_duplicates
  on public.warehouse_storage;

create trigger warehouse_storage_cleanup_arkline_zero_duplicates
after insert or update of rack_location_id, source_variant_code, sku_id, item_name, size, category_id, brand_code, qty
on public.warehouse_storage
for each row
execute function public.cleanup_arkline_shelving_zero_duplicates_trigger();

revoke execute on function public.cleanup_arkline_shelving_zero_duplicates() from public;
revoke execute on function public.cleanup_arkline_shelving_zero_duplicates_trigger() from public;
