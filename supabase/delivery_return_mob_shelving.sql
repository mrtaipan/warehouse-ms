-- Run after delivery_return_completion.sql and rack_location_picking_shelf.sql.
-- MOB customer returns with a unique matching picking shelf go directly into
-- warehouse_storage. Items without exactly one matching shelf remain queued.

create or replace function public.route_mob_delivery_return_to_shelving()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.delivery_return_items%rowtype;
  v_location_count integer := 0;
  v_sku_key text;
  v_destination record;
  v_actor text;
begin
  if new.delivery_return_item_id is null then
    return new;
  end if;

  select * into v_item
  from public.delivery_return_items
  where id = new.delivery_return_item_id;

  if not found or v_item.outcome <> 'STORED' or upper(btrim(coalesce(v_item.group_code, ''))) <> 'MOB' then
    return new;
  end if;

  v_sku_key := pg_catalog.regexp_replace(upper(coalesce(v_item.sku, '')), '[^A-Z0-9]', '', 'g');
  if v_sku_key = '' then
    return new;
  end if;

  select count(distinct stock.rack_location_id) into v_location_count
  from public.warehouse_storage stock
  join public.dir_rack_locations location on location.id = stock.rack_location_id
  where upper(btrim(coalesce(location.group_code, ''))) = 'MOB'
    and upper(btrim(coalesce(location.location_type, ''))) = 'SHELVING'
    and location.is_picking_shelf is true
    and pg_catalog.regexp_replace(upper(coalesce(stock.sku_id, stock.source_variant_code, '')), '[^A-Z0-9]', '', 'g') = v_sku_key
    and public.warehouse_sizes_match(stock.size, v_item.size);

  if v_location_count <> 1 then
    return new;
  end if;

  select stock.id as storage_id, location.location_type, location.location_id,
         location.location_code, location.sub_location
  into v_destination
  from public.warehouse_storage stock
  join public.dir_rack_locations location on location.id = stock.rack_location_id
  where upper(btrim(coalesce(location.group_code, ''))) = 'MOB'
    and upper(btrim(coalesce(location.location_type, ''))) = 'SHELVING'
    and location.is_picking_shelf is true
    and pg_catalog.regexp_replace(upper(coalesce(stock.sku_id, stock.source_variant_code, '')), '[^A-Z0-9]', '', 'g') = v_sku_key
    and public.warehouse_sizes_match(stock.size, v_item.size)
  order by stock.id
  limit 1
  for update of stock;

  if v_destination.storage_id is null then
    return new;
  end if;

  v_actor := coalesce(
    nullif(btrim(new.created_by), ''),
    nullif(btrim((select auth.jwt() ->> 'email')), ''),
    (select auth.uid())::text
  );

  update public.warehouse_storage
  set qty = coalesce(qty, 0) + new.qty,
      updated_by = v_actor,
      updated_at = now()
  where id = v_destination.storage_id;

  update public.delivery_return_items
  set route_status = 'STORED', handled_at = now(), handled_by = v_actor,
      updated_at = now(), updated_by = v_actor
  where id = v_item.id;

  insert into public.warehouse_storage_movements (
    warehouse_storage_id, delivery_return_item_id, movement_type, qty,
    from_location_label, to_location_label, item_name, size, sku_id, created_by
  ) values (
    v_destination.storage_id, v_item.id, 'CUSTOMER_RETURN_IN', new.qty,
    coalesce(new.source_location_label, 'CUSTOMER RETURN'),
    pg_catalog.concat_ws(' / ', v_destination.location_type, v_destination.location_id,
      v_destination.location_code, nullif(v_destination.sub_location, '')),
    coalesce(new.item_name, v_item.product_name), v_item.size, v_item.sku, v_actor
  );

  -- Suppress the queue row after stock and movement history are recorded.
  return null;
end;
$$;

revoke all on function public.route_mob_delivery_return_to_shelving() from public, anon;
grant execute on function public.route_mob_delivery_return_to_shelving() to authenticated, service_role;

drop trigger if exists warehouse_shelving_queue_route_mob_delivery_return
  on public.warehouse_shelving_queue;
create trigger warehouse_shelving_queue_route_mob_delivery_return
  before insert on public.warehouse_shelving_queue
  for each row execute function public.route_mob_delivery_return_to_shelving();
