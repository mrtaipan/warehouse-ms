-- Requires warehouse_shelving_queue.sql. Run upload_sales_import_arkline_workflow.sql
-- as well before using the 21:00 sales offset.
-- Arkline completion is atomic: take from the selected source, put excess into
-- its one matching shelving location (or the queue), then complete the request.

begin;

alter table public.restock_request
  add column if not exists source_sku_id text,
  add column if not exists fulfilled_qty integer;

alter table public.warehouse_storage_movements
  drop constraint if exists warehouse_storage_movements_type_check;

alter table public.warehouse_storage_movements
  add constraint warehouse_storage_movements_type_check
  check (movement_type in (
    'STORE_QUEUE', 'MOVE', 'TAKE_OUT', 'TEMPORARY_IN', 'TEMPORARY_RETURN',
    'TEMPORARY_ADJUSTMENT_IN', 'TEMPORARY_ADJUSTMENT_OUT', 'PUTAWAY_IN',
    'CUSTOMER_RETURN_IN', 'CUSTOMER_REPLACEMENT_OUT', 'QC_RECHECK_OUT', 'REJECT_OUT'
  ));

create or replace function public.complete_arkline_restock_request(
  p_request_id uuid,
  p_source_storage_id bigint,
  p_fulfilled_qty integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.restock_request%rowtype;
  v_source public.warehouse_storage%rowtype;
  v_source_location public.dir_rack_locations%rowtype;
  v_destination public.warehouse_storage%rowtype;
  v_destination_location public.dir_rack_locations%rowtype;
  v_source_sku text;
  v_source_size text;
  v_sku_key text;
  v_size_key text;
  v_source_size_key text;
  v_source_label text := 'Location is not found';
  v_actor text;
  v_excess integer;
  v_location_count integer := 0;
  v_destination_type text := 'NONE';
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if p_fulfilled_qty is null or p_fulfilled_qty <= 0 then
    raise exception 'Actual take qty must be greater than zero';
  end if;
  if p_source_storage_id is null then
    raise exception 'Choose an Arkline pallet as the restock source';
  end if;

  select * into v_request
  from public.restock_request
  where id = p_request_id;
  if not found then
    raise exception 'Restock request not found';
  end if;

  if p_source_storage_id is not null then
    select coalesce(nullif(trim(sku_id), ''), nullif(trim(source_variant_code), '')), size
    into v_source_sku, v_source_size
    from public.warehouse_storage
    where id = p_source_storage_id;
  end if;
  v_sku_key := substring(
    pg_catalog.regexp_replace(upper(coalesce(v_source_sku, v_request.search_term, '')), '[^A-Z0-9]', '', 'g')
    from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}'
  );
  v_size_key := (public.warehouse_size_aliases(coalesce(nullif(trim(v_request.size), ''), v_source_size)))[1];

  -- Use the same SKU/size lock as upload settlement before touching stock.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(coalesce(v_sku_key, p_request_id::text)),
    pg_catalog.hashtext(v_size_key)
  );

  select * into v_request
  from public.restock_request
  where id = p_request_id
  for update;
  if upper(coalesce(v_request.source_type, '')) <> 'ARKLINE' then
    raise exception 'Only Arkline requests use this completion flow';
  end if;
  if v_request.request_status <> 'open' then
    raise exception 'This restock request has already been completed';
  end if;
  if pg_catalog.regexp_replace(upper(coalesce(v_request.size, '')), '[^A-Z0-9]', '', 'g') = '' then
    raise exception 'Arkline request size is required before completion';
  end if;

  v_actor := coalesce(nullif((select auth.jwt()) ->> 'email', ''), (select auth.uid())::text);
  v_excess := greatest(p_fulfilled_qty - v_request.qty, 0);

  if p_source_storage_id is not null then
    select * into v_source
    from public.warehouse_storage
    where id = p_source_storage_id
    for update;
    if not found then
      raise exception 'Source storage item is no longer available';
    end if;
    select * into v_source_location
    from public.dir_rack_locations
    where id = v_source.rack_location_id;
    if upper(coalesce(v_source_location.group_code, '')) <> 'ARKLINE' then
      raise exception 'Selected source is not an Arkline location';
    end if;
    if upper(coalesce(v_source_location.location_type, '')) <> 'PALLET' then
      raise exception 'Arkline restock can only take from a pallet';
    end if;
    if v_source.qty < p_fulfilled_qty then
      raise exception 'Source storage quantity is no longer enough';
    end if;
    v_source_label := pg_catalog.concat_ws(' / ',
      nullif(trim(v_source_location.location_type), ''),
      nullif(trim(v_source_location.location_id::text), ''),
      nullif(trim(v_source_location.location_code), ''),
      nullif(trim(v_source_location.sub_location), '')
    );
    v_source_sku := coalesce(nullif(trim(v_source.sku_id), ''), nullif(trim(v_source.source_variant_code), ''));
    v_sku_key := substring(
      pg_catalog.regexp_replace(upper(coalesce(v_source_sku, '')), '[^A-Z0-9]', '', 'g')
      from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}'
    );
    v_source_size_key := (public.warehouse_size_aliases(v_source.size))[1];
    if v_source_size_key <> '' and v_size_key <> '' and v_source_size_key <> v_size_key then
      raise exception 'Selected source size does not match the request';
    end if;
    v_size_key := coalesce(nullif(v_source_size_key, ''), v_size_key);

    if v_source.qty = p_fulfilled_qty then
      delete from public.warehouse_storage where id = v_source.id;
    else
      update public.warehouse_storage
      set qty = qty - p_fulfilled_qty, updated_by = v_actor, updated_at = now()
      where id = v_source.id;
    end if;
  end if;

  if v_excess > 0 then
    -- The selected Take From row is the only row whose stock is deducted.
    -- If no source row was found, we can still place the fulfilled excess
    -- directly into the one matching Arkline shelving location.
    if (p_source_storage_id is null
        or upper(coalesce(v_source_location.location_type, '')) = 'PALLET')
       and v_sku_key is not null and v_size_key <> '' then
      select count(distinct storage.rack_location_id)
      into v_location_count
      from public.warehouse_storage storage
      join public.dir_rack_locations location on location.id = storage.rack_location_id
      where upper(coalesce(location.group_code, '')) = 'ARKLINE'
        and upper(coalesce(location.location_type, '')) = 'SHELVING'
        and substring(
          pg_catalog.regexp_replace(upper(coalesce(storage.sku_id, storage.source_variant_code, '')), '[^A-Z0-9]', '', 'g')
          from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}'
        ) = v_sku_key
        and (public.warehouse_size_aliases(storage.size))[1] = v_size_key;

      if v_location_count = 1 then
        select storage.*
        into v_destination
        from public.warehouse_storage storage
        join public.dir_rack_locations location on location.id = storage.rack_location_id
        where upper(coalesce(location.group_code, '')) = 'ARKLINE'
          and upper(coalesce(location.location_type, '')) = 'SHELVING'
          and substring(
            pg_catalog.regexp_replace(upper(coalesce(storage.sku_id, storage.source_variant_code, '')), '[^A-Z0-9]', '', 'g')
            from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}'
          ) = v_sku_key
          and (public.warehouse_size_aliases(storage.size))[1] = v_size_key
        order by storage.id
        limit 1
        for update of storage;

        if v_destination.id is not null then
          select * into v_destination_location
          from public.dir_rack_locations
          where id = v_destination.rack_location_id;
        end if;
      end if;
    end if;

    if v_destination.id is not null then
      update public.warehouse_storage
      set qty = qty + v_excess, updated_by = v_actor, updated_at = now()
      where id = v_destination.id;

      insert into public.warehouse_storage_movements (
        warehouse_storage_id, movement_type, qty, from_location_label,
        to_location_label, item_name, size, sku_id, created_by
      ) values (
        v_destination.id, 'PUTAWAY_IN', v_excess, v_source_label,
        pg_catalog.concat_ws(' / ',
          nullif(trim(v_destination_location.location_type), ''),
          nullif(trim(v_destination_location.location_id::text), ''),
          nullif(trim(v_destination_location.location_code), ''),
          nullif(trim(v_destination_location.sub_location), '')
        ),
        coalesce(v_source.item_name, v_request.item_name),
        coalesce(v_source.size, v_request.size),
        coalesce(v_source_sku, v_request.search_term),
        v_actor
      );
      v_destination_type := 'SHELVING';
    else
      insert into public.warehouse_shelving_queue (
        restock_request_id, source_storage_id, source_location_label,
        source_pl_packing_item_id, sku_id, source_variant_code,
        item_name, size, group_code, qty, notes, created_by
      ) values (
        p_request_id, p_source_storage_id, v_source_label,
        v_source.source_pl_packing_item_id, coalesce(v_source_sku, v_request.search_term),
        coalesce(v_source.source_variant_code, v_source_sku),
        coalesce(v_source.item_name, v_request.item_name),
        coalesce(v_source.size, v_request.size), 'ARKLINE', v_excess,
        'Excess from restock request ' || p_request_id::text, v_actor
      );
      v_destination_type := 'QUEUE';
    end if;
  end if;

  update public.restock_request
  set take_from = v_source_label,
      storage_id = p_source_storage_id,
      source_sku_id = coalesce(v_source_sku, v_request.search_term),
      fulfilled_qty = p_fulfilled_qty,
      request_status = 'completed',
      completed_at = now(),
      completed_by = v_actor
  where id = p_request_id;

  return pg_catalog.jsonb_build_object(
    'request_id', p_request_id,
    'excess_qty', v_excess,
    'excess_destination', v_destination_type
  );
end;
$$;

revoke execute on function public.complete_arkline_restock_request(uuid, bigint, integer) from public, anon;
grant execute on function public.complete_arkline_restock_request(uuid, bigint, integer) to authenticated;

commit;
