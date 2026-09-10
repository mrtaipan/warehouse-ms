-- Split legacy ARKLINE warehouse storage rows saved as "SKU | item name".
-- After this backfill, sku_id contains the ARKLINE SKU and item_name contains only the product name.

update public.warehouse_storage storage
set
  sku_id = coalesce(
    nullif(trim(storage.sku_id), ''),
    upper(trim(split_part(storage.item_name, '|', 1)))
  ),
  item_name = trim(substr(storage.item_name, position('|' in storage.item_name) + 1)),
  updated_at = now()
from public.dir_rack_locations rack
where rack.id = storage.rack_location_id
  and upper(trim(coalesce(rack.group_code, ''))) = 'ARKLINE'
  and position('|' in storage.item_name) > 0
  and upper(trim(split_part(storage.item_name, '|', 1))) like 'ARK%'
  and nullif(trim(substr(storage.item_name, position('|' in storage.item_name) + 1)), '') is not null;
