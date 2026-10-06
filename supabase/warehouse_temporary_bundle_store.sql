-- Store selected Temporary Sales items as an existing product bundle.
-- This reuses warehouse_storage and warehouse_storage_movements; no new table is required.
create or replace function public.store_temporary_sales_as_bundle(
  p_bundle_id bigint,
  p_bundle_qty integer,
  p_destination_rack_location_id bigint,
  p_destination_label text,
  p_items jsonb,
  p_requirements jsonb,
  p_actor text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bundle record;
  v_item record;
  v_temp record;
  v_requirement record;
  v_existing record;
  v_required numeric;
  v_allocated numeric;
  v_size text;
  v_sku text;
  v_storage_id bigint;
  v_stored_sizes integer := 0;
begin
  if p_bundle_qty is null or p_bundle_qty <= 0 then
    raise exception 'Bundle quantity must be greater than zero';
  end if;

  select id, bundle_code, bundle_name, bundle_unit_qty, status
    into v_bundle
  from public.product_bundles
  where id = p_bundle_id
    and coalesce(upper(status), 'DRAFT') <> 'CANCELLED'
  for update;

  if not found then
    raise exception 'Bundle was not found or is cancelled';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one temporary item is required';
  end if;

  if p_requirements is null or jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) = 0 then
    raise exception 'Bundle requirements are missing';
  end if;

  if not exists (
    select 1
    from public.dir_rack_locations
    where id = p_destination_rack_location_id
  ) then
    raise exception 'Destination storage location was not found';
  end if;

  -- Validate that the selected temporary rows provide exactly the recipe requested by the UI.
  -- The rows are locked before they are consumed, preventing double-store from concurrent clicks.
  for v_requirement in
    select * from jsonb_to_recordset(p_requirements) as r(sku text, size text, qty numeric)
  loop
    v_required := coalesce(v_requirement.qty, 0);
    if v_required <= 0 then
      raise exception 'Bundle requirement quantity must be greater than zero';
    end if;

    select coalesce(sum((i.qty)::numeric), 0)
      into v_allocated
    from jsonb_to_recordset(p_items) as i(temporary_item_id bigint, qty numeric)
    join public.warehouse_temporary_sales_items t on t.id = i.temporary_item_id
    where t.status = 'IN_TEMPORARY_AREA'
      and coalesce(t.area_type, 'SALES') = 'SALES'
      and regexp_replace(upper(coalesce(t.sku_id, t.source_variant_code, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(coalesce(v_requirement.sku, '')), '[^A-Z0-9]', '', 'g')
      and coalesce(nullif(trim(t.size), ''), '-') = coalesce(nullif(trim(v_requirement.size), ''), '-');

    if v_allocated <> v_required then
      raise exception 'Selected temporary quantities do not match the bundle recipe for SKU % size %', v_requirement.sku, v_requirement.size;
    end if;
  end loop;

  for v_item in
    select * from jsonb_to_recordset(p_items) as i(temporary_item_id bigint, qty numeric)
  loop
    if v_item.qty is null or v_item.qty <= 0 then
      raise exception 'Temporary item quantity must be greater than zero';
    end if;

    select * into v_temp
    from public.warehouse_temporary_sales_items
    where id = v_item.temporary_item_id
    for update;

    if not found or v_temp.status <> 'IN_TEMPORARY_AREA' or coalesce(v_temp.area_type, 'SALES') <> 'SALES' then
      raise exception 'Temporary item % is no longer available for bundling', v_item.temporary_item_id;
    end if;
    if v_item.qty > coalesce(v_temp.qty_in_area, 0) then
      raise exception 'Temporary item % has insufficient quantity', v_item.temporary_item_id;
    end if;

    update public.warehouse_temporary_sales_items
    set qty_in_area = qty_in_area - v_item.qty,
        status = case when qty_in_area - v_item.qty <= 0 then 'COMPLETED' else 'IN_TEMPORARY_AREA' end,
        updated_at = now()
    where id = v_item.temporary_item_id;

    insert into public.warehouse_storage_movements (
      warehouse_storage_id,
      temporary_sales_item_id,
      movement_type,
      qty,
      from_location_label,
      to_location_label,
      item_name,
      size,
      sku_id,
      created_by
    ) values (
      null,
      v_temp.id,
      'TEMPORARY_RETURN',
      v_item.qty,
      'Temporary Sales Area',
      coalesce(p_destination_label, 'Warehouse Storage') || ' / Bundle ' || v_bundle.bundle_code,
      v_temp.item_name,
      v_temp.size,
      v_temp.sku_id,
      p_actor
    );
  end loop;

  for v_size in
    select distinct coalesce(nullif(trim(r.size), ''), '-')
    from jsonb_to_recordset(p_requirements) as r(sku text, size text, qty numeric)
  loop
    select id, qty into v_existing
    from public.warehouse_storage
    where rack_location_id = p_destination_rack_location_id
      and regexp_replace(upper(coalesce(sku_id, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(v_bundle.bundle_code), '[^A-Z0-9]', '', 'g')
      and coalesce(nullif(trim(size), ''), '-') = v_size
    for update;

    if found then
      update public.warehouse_storage
      set qty = coalesce(qty, 0) + p_bundle_qty,
          updated_by = p_actor,
          updated_at = now()
      where id = v_existing.id
      returning id into v_storage_id;
    else
      insert into public.warehouse_storage (
        rack_location_id,
        sku_id,
        source_variant_code,
        item_name,
        size,
        qty,
        notes,
        updated_by
      ) values (
        p_destination_rack_location_id,
        v_bundle.bundle_code,
        v_bundle.bundle_code,
        coalesce(v_bundle.bundle_name, v_bundle.bundle_code),
        nullif(v_size, '-'),
        p_bundle_qty,
        'Stored as bundle ' || v_bundle.bundle_code,
        p_actor
      ) returning id into v_storage_id;
    end if;

    insert into public.warehouse_storage_movements (
      warehouse_storage_id,
      temporary_sales_item_id,
      movement_type,
      qty,
      from_location_label,
      to_location_label,
      item_name,
      size,
      sku_id,
      created_by
    ) values (
      v_storage_id,
      null,
      'TEMPORARY_RETURN',
      p_bundle_qty,
      'Temporary Sales Area',
      coalesce(p_destination_label, 'Warehouse Storage'),
      coalesce(v_bundle.bundle_name, v_bundle.bundle_code),
      nullif(v_size, '-'),
      v_bundle.bundle_code,
      p_actor
    );
    v_stored_sizes := v_stored_sizes + 1;
  end loop;

  return jsonb_build_object(
    'bundle_id', v_bundle.id,
    'bundle_code', v_bundle.bundle_code,
    'bundle_qty', p_bundle_qty,
    'size_count', v_stored_sizes
  );
end;
$$;

grant execute on function public.store_temporary_sales_as_bundle(bigint, integer, bigint, text, jsonb, jsonb, text) to authenticated;
