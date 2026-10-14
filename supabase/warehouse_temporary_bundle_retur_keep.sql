-- Convert selected Temporary Sales components into a bundle in Temp. Retur Keeping.
-- This reuses warehouse_temporary_sales_items and warehouse_storage_movements.
create or replace function public.move_temporary_sales_bundle_to_retur_keeping(
  p_bundle_id bigint,
  p_bundle_qty integer,
  p_items jsonb,
  p_requirements jsonb,
  p_category_id bigint default null,
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
  v_temp public.warehouse_temporary_sales_items%rowtype;
  v_requirement record;
  v_allocated numeric;
  v_bundle_size text;
  v_size_count integer;
  v_target_id bigint;
  v_now timestamptz := now();
begin
  if p_bundle_qty is null or p_bundle_qty <= 0 then
    raise exception 'Bundle quantity must be greater than zero';
  end if;

  select id, bundle_code, bundle_name, storing_type, status, is_size_dependent
    into v_bundle
  from public.product_bundles
  where id = p_bundle_id
    and coalesce(upper(status), 'DRAFT') <> 'CANCELLED'
  for share;

  if not found then
    raise exception 'Bundle was not found or is cancelled';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one temporary item is required';
  end if;

  if p_requirements is null or jsonb_typeof(p_requirements) <> 'array' or jsonb_array_length(p_requirements) = 0 then
    raise exception 'Bundle requirements are missing';
  end if;

  if (
    select count(*) <> count(distinct temporary_item_id)
    from jsonb_to_recordset(p_items) as i(temporary_item_id bigint, qty numeric)
  ) then
    raise exception 'A temporary item can only be allocated once';
  end if;

  if coalesce(v_bundle.is_size_dependent, true) then
    select count(distinct coalesce(nullif(trim(r.size), ''), '-')),
           min(coalesce(nullif(trim(r.size), ''), '-'))
      into v_size_count, v_bundle_size
    from jsonb_to_recordset(p_requirements) as r(sku text, size text, qty numeric);

    if v_size_count <> 1 then
      raise exception 'Choose exactly one bundle size';
    end if;
  else
    v_bundle_size := null;
  end if;

  -- Lock all source rows before validating or changing quantities.
  for v_item in
    select *
    from jsonb_to_recordset(p_items) as i(temporary_item_id bigint, qty numeric)
    order by temporary_item_id
  loop
    if v_item.qty is null or v_item.qty <= 0 then
      raise exception 'Temporary item quantity must be greater than zero';
    end if;

    select * into v_temp
    from public.warehouse_temporary_sales_items
    where id = v_item.temporary_item_id
    for update;

    if not found
      or v_temp.status <> 'IN_TEMPORARY_AREA'
      or coalesce(v_temp.area_type, 'SALES') <> 'SALES'
      or v_item.qty > coalesce(v_temp.qty_in_area, 0) then
      raise exception 'Temporary item % is no longer available in the requested quantity', v_item.temporary_item_id;
    end if;

    if nullif(trim(v_temp.group_code), '') is not null
      and upper(trim(v_temp.group_code)) <> upper(trim(v_bundle.storing_type)) then
      raise exception 'Temporary item % belongs to a different group than this bundle', v_item.temporary_item_id;
    end if;

    if not exists (
      select 1
      from jsonb_to_recordset(p_requirements) as r(sku text, size text, qty numeric)
      where regexp_replace(upper(coalesce(r.sku, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(coalesce(v_temp.sku_id, v_temp.source_variant_code, '')), '[^A-Z0-9]', '', 'g')
        and (
          not coalesce(v_bundle.is_size_dependent, true)
          or coalesce(nullif(trim(r.size), ''), '-') = coalesce(nullif(trim(v_temp.size), ''), '-')
        )
    ) then
      raise exception 'Temporary item % is not a component of the selected bundle size', v_item.temporary_item_id;
    end if;
  end loop;

  for v_requirement in
    select * from jsonb_to_recordset(p_requirements) as r(sku text, size text, qty numeric)
  loop
    if coalesce(v_requirement.qty, 0) <= 0 then
      raise exception 'Bundle requirement quantity must be greater than zero';
    end if;

    select coalesce(sum(i.qty), 0)
      into v_allocated
    from jsonb_to_recordset(p_items) as i(temporary_item_id bigint, qty numeric)
    join public.warehouse_temporary_sales_items t on t.id = i.temporary_item_id
    where regexp_replace(upper(coalesce(t.sku_id, t.source_variant_code, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(coalesce(v_requirement.sku, '')), '[^A-Z0-9]', '', 'g')
      and (
        not coalesce(v_bundle.is_size_dependent, true)
        or coalesce(nullif(trim(t.size), ''), '-') = coalesce(nullif(trim(v_requirement.size), ''), '-')
      );

    if v_allocated <> v_requirement.qty then
      raise exception 'Selected quantities do not match the bundle recipe for SKU % size %', v_requirement.sku, coalesce(v_requirement.size, '-');
    end if;
  end loop;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as i(temporary_item_id bigint, qty numeric)
    order by temporary_item_id
  loop
    select * into v_temp
    from public.warehouse_temporary_sales_items
    where id = v_item.temporary_item_id;

    update public.warehouse_temporary_sales_items
    set qty_in_area = qty_in_area - v_item.qty,
        status = case when qty_in_area - v_item.qty <= 0 then 'COMPLETED' else 'IN_TEMPORARY_AREA' end,
        updated_at = v_now
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
      'Temp. Retur Keeping / Bundle ' || v_bundle.bundle_code,
      v_temp.item_name,
      v_temp.size,
      v_temp.sku_id,
      p_actor
    );
  end loop;

  insert into public.warehouse_temporary_sales_items (
    source_warehouse_storage_id,
    source_pl_packing_item_id,
    sku_id,
    item_name,
    size,
    category_id,
    group_code,
    area_type,
    source_location_label,
    qty_in_area,
    status,
    entered_at,
    due_at,
    created_by
  ) values (
    null,
    null,
    v_bundle.bundle_code,
    coalesce(v_bundle.bundle_name, v_bundle.bundle_code),
    case when coalesce(v_bundle.is_size_dependent, true) and v_bundle_size <> '-' then v_bundle_size end,
    p_category_id,
    v_bundle.storing_type,
    'RETUR_KEEPING',
    'Temporary Sales Area / Bundle ' || v_bundle.bundle_code,
    p_bundle_qty,
    'IN_TEMPORARY_AREA',
    v_now,
    v_now + interval '7 days',
    p_actor
  ) returning id into v_target_id;

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
    v_target_id,
    'TEMPORARY_IN',
    p_bundle_qty,
    'Temporary Sales Area',
    'Temp. Retur Keeping',
    coalesce(v_bundle.bundle_name, v_bundle.bundle_code),
    case when coalesce(v_bundle.is_size_dependent, true) and v_bundle_size <> '-' then v_bundle_size end,
    v_bundle.bundle_code,
    p_actor
  );

  return jsonb_build_object(
    'bundle_id', v_bundle.id,
    'bundle_code', v_bundle.bundle_code,
    'bundle_qty', p_bundle_qty,
    'size', case when coalesce(v_bundle.is_size_dependent, true) and v_bundle_size <> '-' then v_bundle_size end,
    'temporary_item_id', v_target_id
  );
end;
$$;

revoke all on function public.move_temporary_sales_bundle_to_retur_keeping(bigint, integer, jsonb, jsonb, bigint, text) from public, anon;
grant execute on function public.move_temporary_sales_bundle_to_retur_keeping(bigint, integer, jsonb, jsonb, bigint, text) to authenticated;
