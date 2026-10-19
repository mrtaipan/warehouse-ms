-- Separate shelving sales uploads by warehouse group.
-- Requires warehouse_stock_size_matching.sql.
-- Existing batches are treated as MOB for backward compatibility.
-- For MOB 21:00 settlement and ARK rows, run upload_sales_import_arkline_workflow.sql
-- before using the functions below, then schedule upload_sales_import_arkline_2100_cron.sql.
alter table public.upload_sales_import_batches
  add column if not exists group_code text;

update public.upload_sales_import_batches
set group_code = 'MOB'
where group_code is null
   or upper(trim(group_code)) not in ('MOB', 'ARKLINE');

alter table public.upload_sales_import_batches
  alter column group_code set default 'MOB';

alter table public.upload_sales_import_batches
  alter column group_code set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.upload_sales_import_batches'::regclass
      and conname = 'upload_sales_import_batches_group_code_check'
  ) then
    alter table public.upload_sales_import_batches
      add constraint upload_sales_import_batches_group_code_check
      check (group_code in ('MOB', 'ARKLINE'));
  end if;
end $$;

alter table public.upload_sales_import_batches
  drop constraint if exists upload_sales_import_batches_file_hash_key;

create unique index if not exists upload_sales_import_batches_group_file_hash_key
  on public.upload_sales_import_batches (group_code, file_hash)
  where file_hash is not null;

create index if not exists upload_sales_import_batches_group_idx
  on public.upload_sales_import_batches (group_code, uploaded_at desc);

-- Index the same SKU tokens previously parsed once per stock row per upload line.
create or replace function public.upload_stock_sku_tokens(p_sku text, p_variant text, p_name text)
returns text[]
language sql
immutable
parallel safe
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(distinct upper(regexp_replace(raw_value, '[^A-Z0-9]', '', 'g'))), array[]::text[])
  from regexp_split_to_table(
    coalesce(p_sku, '') || ' ' || coalesce(p_variant, '') || ' ' || coalesce(p_name, ''),
    '[[:space:]|,;/]+'
  ) as token(raw_value);
$$;

revoke all on function public.upload_stock_sku_tokens(text, text, text) from public, anon;
grant execute on function public.upload_stock_sku_tokens(text, text, text) to authenticated, service_role;

create index if not exists warehouse_storage_upload_sku_tokens_idx
  on public.warehouse_storage using gin (public.upload_stock_sku_tokens(sku_id, source_variant_code, item_name))
  where coalesce(qty, 0) > 0;

create index if not exists warehouse_temporary_upload_sku_tokens_idx
  on public.warehouse_temporary_sales_items using gin (public.upload_stock_sku_tokens(sku_id, source_variant_code, item_name))
  where status = 'IN_TEMPORARY_AREA' and coalesce(area_type, 'SALES') = 'SALES'
    and coalesce(qty_in_area, 0) > 0;

create or replace function public.expand_upload_bundle_lines(p_batch_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_line record;
  v_bundle_id bigint;
  v_bundle_code text;
  v_bundle_unit_qty integer;
  component record;
  component_size_total numeric;
  size_bundle_count numeric;
  direct_qty numeric;
  component_qty numeric;
  next_row integer;
  v_group_code text;
begin
  select coalesce(nullif(upper(trim(group_code)), ''), 'MOB')
    into v_group_code
  from public.upload_sales_import_batches
  where id = p_batch_id;
  select coalesce(max(row_number), 0) into next_row
  from public.upload_sales_import_lines
  where batch_id = p_batch_id;

  for source_line in
    select line.*
    from public.upload_sales_import_lines line
    join public.product_bundles bundle_match
      on regexp_replace(upper(coalesce(line.sku_id, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(bundle_match.bundle_code), '[^A-Z0-9]', '', 'g')
    where line.batch_id = p_batch_id
      and line.included = true
      and line.qty > 0
      and bundle_match.status in ('draft', 'released')
  loop
    select b.id, b.bundle_code, b.bundle_unit_qty
      into v_bundle_id, v_bundle_code, v_bundle_unit_qty
    from public.product_bundles b
    where regexp_replace(upper(coalesce(source_line.sku_id, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(b.bundle_code), '[^A-Z0-9]', '', 'g')
      and b.status in ('draft', 'released')
    order by b.id desc
    limit 1;

    if not found then
      continue;
    end if;

    select coalesce(sum(stock.qty), 0)
      into direct_qty
    from public.warehouse_storage stock
    join public.dir_rack_locations stock_location
      on stock_location.id = stock.rack_location_id
    where coalesce(nullif(upper(trim(stock_location.group_code)), ''), 'MOB') = v_group_code
      and regexp_replace(upper(coalesce(stock.sku_id, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(v_bundle_code), '[^A-Z0-9]', '', 'g')
      and (coalesce(nullif(trim(source_line.size), ''), '-') = '-'
        or coalesce(nullif(trim(stock.size), ''), '-') = coalesce(nullif(trim(source_line.size), ''), '-'));

    select direct_qty + coalesce(sum(temp.qty_in_area), 0)
      into direct_qty
    from public.warehouse_temporary_sales_items temp
    where temp.status = 'IN_TEMPORARY_AREA'
      and coalesce(temp.area_type, 'SALES') = 'SALES'
      and coalesce(nullif(upper(trim(temp.group_code)), ''), 'MOB') = v_group_code
      and regexp_replace(upper(coalesce(temp.sku_id, temp.source_variant_code, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(v_bundle_code), '[^A-Z0-9]', '', 'g')
      and (coalesce(nullif(trim(source_line.size), ''), '-') = '-'
        or coalesce(nullif(trim(temp.size), ''), '-') = coalesce(nullif(trim(source_line.size), ''), '-'));

    -- Keep the original line when the warehouse already stores the bundle.
    if direct_qty > 0 then
      continue;
    end if;

    for component in
      select
        min(c.sku) as sku,
        min(c.product_name) as product_name,
        c.size_label,
        sum(c.allocated_qty)::integer as allocated_qty
      from public.product_bundle_components c
      where c.bundle_id = v_bundle_id
      group by c.sku, c.size_label
      order by c.sku, c.size_label
    loop
      select coalesce(sum(c2.allocated_qty), 0)
        into component_size_total
      from public.product_bundle_components c2
      where c2.bundle_id = v_bundle_id
        and coalesce(nullif(trim(c2.size_label), ''), '-') = coalesce(nullif(trim(component.size_label), ''), '-');
      size_bundle_count := floor(component_size_total / greatest(v_bundle_unit_qty, 1));
      component_qty := case
        when size_bundle_count > 0 then source_line.qty * component.allocated_qty / size_bundle_count
        else 0
      end;
      if component_qty <> trunc(component_qty) then
        raise exception 'Bundle % cannot be expanded: component quantity is not a whole number', v_bundle_code;
      end if;

      next_row := next_row + 1;
      insert into public.upload_sales_import_lines (
        batch_id, row_number, order_number, order_status, sku_id,
        product_name, variation_raw, size, qty, included, exclusion_reason, order_date
      ) values (
        source_line.batch_id, next_row, source_line.order_number, source_line.order_status,
        component.sku, coalesce(component.product_name, component.sku),
        'Expanded from bundle ' || v_bundle_code, coalesce(component.size_label, source_line.size),
        component_qty::integer, true, null, source_line.order_date
      );
    end loop;

    update public.upload_sales_import_lines
    set included = false,
        exclusion_reason = 'Expanded into component SKU rows'
    where id = source_line.id;
  end loop;
end;
$$;

create or replace function public.settle_mob_sales_import_batch(
  p_batch_id uuid,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_batch public.upload_sales_import_batches%rowtype;
  import_line public.upload_sales_import_lines%rowtype;
  storage_row record;
  temporary_sales_row record;
  remaining_qty integer;
  take_qty integer;
  line_applied integer;
  line_skipped integer;
  total_applied integer := 0;
  total_skipped integer := 0;
  shortage_lines integer := 0;
  actor_email text := nullif(trim(coalesce(p_actor_email, '')), '');
  normalized_sku text;
  normalized_size text;
  allow_any_size boolean;
  arkline_result jsonb;
  total_pick integer := 0;
begin
  if current_user <> 'postgres' and not public.arkline_upload_can_manage() then
    raise exception 'Not allowed to settle MOB uploads';
  end if;

  select *
    into target_batch
  from public.upload_sales_import_batches
  where id = p_batch_id
  for update;

  if target_batch.id is null then
    raise exception 'Shelving sales import batch not found';
  end if;

  if target_batch.group_code <> 'MOB' or target_batch.status <> 'pending_settlement' then
    raise exception 'Only pending MOB import batches can be settled. Current status: %', target_batch.status;
  end if;

  perform public.expand_upload_bundle_lines(p_batch_id);

  if exists (
    select 1 from public.upload_sales_import_lines line
    where line.batch_id = p_batch_id and line.included = true and line.qty > 0
      and regexp_replace(upper(coalesce(line.sku_id, '')), '[^A-Z0-9]', '', 'g') ~ '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}$'
  ) then
    arkline_result := public.settle_arkline_sales_import_batch(p_batch_id, actor_email);
    total_pick := coalesce((arkline_result->>'pick_offset_qty')::integer, 0);
    total_applied := coalesce((arkline_result->>'applied_qty')::integer, 0);
    total_skipped := coalesce((arkline_result->>'skipped_qty')::integer, 0);
    shortage_lines := coalesce((arkline_result->>'shortage_line_count')::integer, 0);
  end if;

  for import_line in
    select *
    from public.upload_sales_import_lines
    where batch_id = p_batch_id
      and included = true
      and qty > 0
    order by row_number asc, id asc
    for update
  loop
    remaining_qty := import_line.qty;
    line_applied := 0;
    normalized_sku := upper(regexp_replace(coalesce(import_line.sku_id, ''), '[^A-Z0-9]', '', 'g'));
    if normalized_sku ~ '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}$' then
      continue;
    end if;
    normalized_size := upper(regexp_replace(coalesce(import_line.size, ''), '[^A-Z0-9]', '', 'g'));
    if normalized_size = '' then
      normalized_size := '-';
    end if;

    select normalized_size = '-' and exists (
      select 1 from public.product_bundles b
      where b.status in ('draft', 'released')
        and regexp_replace(upper(coalesce(b.bundle_code, '')), '[^A-Z0-9]', '', 'g') = normalized_sku
    ) into allow_any_size;

    if normalized_sku = '' then
      update public.upload_sales_import_lines
      set
        applied_qty = 0,
        skipped_qty = import_line.qty,
        exclusion_reason = coalesce(nullif(exclusion_reason, ''), 'Missing SKU or size at posting')
      where id = import_line.id;

      total_skipped := total_skipped + import_line.qty;
      shortage_lines := shortage_lines + 1;
      continue;
    end if;

    -- Temporary Sales is the first source for a sales upload. Shelving is used
    -- only for any remaining quantity after this loop. The temporary item may
    -- have originated from either a pallet or shelving location.
    if remaining_qty > 0 then
      for temporary_sales_row in
        select
          temporary_item.id,
          temporary_item.sku_id,
          temporary_item.item_name,
          temporary_item.size,
          temporary_item.qty_in_area,
          temporary_item.source_location_label,
          temporary_item.entered_at
        from public.warehouse_temporary_sales_items temporary_item
        where temporary_item.status = 'IN_TEMPORARY_AREA'
          and coalesce(temporary_item.area_type, 'SALES') = 'SALES'
          and coalesce(nullif(upper(trim(temporary_item.group_code)), ''), 'MOB') = coalesce(nullif(upper(trim(target_batch.group_code)), ''), 'MOB')
          and coalesce(temporary_item.qty_in_area, 0) > 0
          and public.upload_stock_sku_tokens(temporary_item.sku_id, temporary_item.source_variant_code, temporary_item.item_name)
            @> array[normalized_sku]
          and (
            allow_any_size
            or public.warehouse_sizes_match(temporary_item.size, import_line.size, import_line.variation_raw)
          )
        order by temporary_item.entered_at asc nulls first, temporary_item.id asc
        for update of temporary_item
      loop
        exit when remaining_qty <= 0;

        take_qty := least(remaining_qty, coalesce(temporary_sales_row.qty_in_area, 0));
        if take_qty <= 0 then
          continue;
        end if;

        insert into public.upload_warehouse_storage_movements (
          source_type,
          source_batch_id,
          source_line_id,
          temporary_sales_item_id,
          movement_type,
          warehouse_storage_id,
          rack_location_id,
          location_snapshot,
          sku_id,
          item_name_snapshot,
          size,
          qty_before,
          qty_delta,
          qty_after,
          storage_row_deleted,
          reference_number,
          created_by,
          notes
        ) values (
          'upload_sales_import',
          p_batch_id,
          import_line.id,
          temporary_sales_row.id,
          'OUT',
          null,
          null,
          jsonb_build_object(
            'source', 'Temporary Sales Area',
            'source_location_label', temporary_sales_row.source_location_label
          ),
          temporary_sales_row.sku_id,
          temporary_sales_row.item_name,
          temporary_sales_row.size,
          temporary_sales_row.qty_in_area,
          -take_qty,
          temporary_sales_row.qty_in_area - take_qty,
          false,
          import_line.order_number,
          actor_email,
          'Daily sales upload deducted Temporary Sales Area stock'
        );

        update public.warehouse_temporary_sales_items
        set
          qty_in_area = temporary_sales_row.qty_in_area - take_qty,
          status = case when temporary_sales_row.qty_in_area = take_qty then 'COMPLETED' else 'IN_TEMPORARY_AREA' end,
          updated_at = now()
        where id = temporary_sales_row.id;

        remaining_qty := remaining_qty - take_qty;
        line_applied := line_applied + take_qty;
      end loop;
    end if;

    for storage_row in
      select
        storage.id,
        storage.rack_location_id,
        storage.sku_id,
        storage.item_name,
        storage.size,
        storage.qty,
        storage.notes,
        location.location_type,
        location.location_id,
        location.location_code,
        location.sub_location,
        location.location_name,
        location.group_code,
        jsonb_build_object(
          'rack_location_id', location.id,
          'location_type', location.location_type,
          'location_id', location.location_id,
          'location_code', location.location_code,
          'sub_location', location.sub_location,
          'location_name', location.location_name,
          'group_code', location.group_code
        ) as location_snapshot
      from public.warehouse_storage storage
      join public.dir_rack_locations location
        on location.id = storage.rack_location_id
      where upper(trim(coalesce(location.location_type, ''))) = 'SHELVING'
        and coalesce(nullif(upper(trim(location.group_code)), ''), 'MOB') = coalesce(nullif(upper(trim(target_batch.group_code)), ''), 'MOB')
        and coalesce(storage.qty, 0) > 0
        and public.upload_stock_sku_tokens(storage.sku_id, storage.source_variant_code, storage.item_name)
          @> array[normalized_sku]
        and (
          allow_any_size
          or public.warehouse_sizes_match(storage.size, import_line.size, import_line.variation_raw)
        )
      order by storage.created_at asc nulls first, storage.id asc
      for update of storage
    loop
      exit when remaining_qty <= 0;

      take_qty := least(remaining_qty, coalesce(storage_row.qty, 0));
      if take_qty <= 0 then
        continue;
      end if;

      insert into public.upload_warehouse_storage_movements (
        source_type,
        source_batch_id,
        source_line_id,
        movement_type,
        warehouse_storage_id,
        rack_location_id,
        location_snapshot,
        sku_id,
        item_name_snapshot,
        size,
        qty_before,
        qty_delta,
        qty_after,
        storage_row_deleted,
        reference_number,
        created_by,
        notes
      ) values (
        'upload_sales_import',
        p_batch_id,
        import_line.id,
        'OUT',
        storage_row.id,
        storage_row.rack_location_id,
        coalesce(storage_row.location_snapshot, '{}'::jsonb),
        storage_row.sku_id,
        storage_row.item_name,
        storage_row.size,
        storage_row.qty,
        -take_qty,
        storage_row.qty - take_qty,
        storage_row.qty = take_qty
          and not (
            upper(trim(coalesce(storage_row.location_snapshot->>'location_type', ''))) = 'SHELVING'
            and upper(trim(coalesce(storage_row.location_snapshot->>'group_code', ''))) = 'ARKLINE'
          ),
        import_line.order_number,
        actor_email,
        'Daily shelving sales upload'
      );

      if storage_row.qty = take_qty then
        if upper(trim(coalesce(storage_row.location_snapshot->>'location_type', ''))) = 'SHELVING'
           and upper(trim(coalesce(storage_row.location_snapshot->>'group_code', ''))) = 'ARKLINE' then
          update public.warehouse_storage
          set qty = 0, updated_by = actor_email, updated_at = now()
          where id = storage_row.id;
        else
          delete from public.warehouse_storage
          where id = storage_row.id;
        end if;
      else
        update public.warehouse_storage
        set
          qty = storage_row.qty - take_qty,
          updated_by = actor_email,
          updated_at = now()
        where id = storage_row.id;
      end if;

      remaining_qty := remaining_qty - take_qty;
      line_applied := line_applied + take_qty;
    end loop;

    line_skipped := greatest(remaining_qty, 0);

    update public.upload_sales_import_lines
    set
      applied_qty = line_applied,
      skipped_qty = line_skipped,
      available_qty_snapshot = greatest(coalesce(available_qty_snapshot, 0), line_applied),
      exclusion_reason = case
        when line_skipped > 0 then 'Insufficient shelving stock'
        else exclusion_reason
      end
    where id = import_line.id;

    total_applied := total_applied + line_applied;
    total_skipped := total_skipped + line_skipped;

    if line_skipped > 0 then
      shortage_lines := shortage_lines + 1;
    end if;
  end loop;

  update public.upload_sales_import_batches
  set
    status = 'posted',
    posted_by = coalesce(actor_email, posted_by),
    posted_at = coalesce(posted_at, now()),
    settled_at = now(),
    settled_by = coalesce(actor_email, 'MOB AUTO 21:00'),
    settlement_error = null,
    raw_retention_until = now() + interval '7 days',
    pick_offset_qty = total_pick,
    applied_qty = total_applied,
    skipped_qty = total_skipped,
    shortage_line_count = shortage_lines
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'posted',
    'pick_offset_qty', total_pick,
    'applied_qty', total_applied,
    'skipped_qty', total_skipped,
    'shortage_line_count', shortage_lines
  );
end;
$$;

create or replace function public.post_upload_sales_import_batch(
  p_batch_id uuid,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_batch public.upload_sales_import_batches%rowtype;
begin
  if not public.arkline_upload_can_manage() then
    raise exception 'Not allowed to manage MOB uploads';
  end if;

  select * into target_batch
  from public.upload_sales_import_batches
  where id = p_batch_id
  for update;

  if target_batch.id is null or target_batch.group_code <> 'MOB' or target_batch.status <> 'draft' then
    raise exception 'Only draft MOB upload batches can be posted';
  end if;

  update public.upload_sales_import_batches
  set status = 'pending_settlement',
      posted_by = nullif(trim(coalesce(p_actor_email, '')), ''),
      posted_at = now(),
      pick_offset_qty = 0,
      applied_qty = 0,
      skipped_qty = 0,
      shortage_line_count = 0,
      settlement_error = null,
      raw_retention_until = 'infinity'::timestamptz,
      updated_at = now()
  where id = p_batch_id;

  update public.upload_sales_import_lines
  set pick_offset_qty = 0,
      applied_qty = 0,
      skipped_qty = 0,
      balance_after_snapshot = null
  where batch_id = p_batch_id;

  if (now() at time zone 'Asia/Jakarta')::time >= time '21:00' then
    return public.settle_mob_sales_import_batch(p_batch_id, p_actor_email);
  end if;

  return jsonb_build_object('batch_id', p_batch_id, 'status', 'pending_settlement');
end;
$$;

create or replace function public.settle_pending_mob_sales_import_batches()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pending_batch record;
  settled_count integer := 0;
  failed_count integer := 0;
begin
  if current_user <> 'postgres' then
    raise exception 'MOB settlement job must run as postgres';
  end if;

  for pending_batch in
    select id from public.upload_sales_import_batches
    where group_code = 'MOB'
      and status = 'pending_settlement'
      and (posted_at at time zone 'Asia/Jakarta')::date <= (now() at time zone 'Asia/Jakarta')::date
    order by posted_at, id
  loop
    begin
      perform public.settle_mob_sales_import_batch(pending_batch.id, null);
      settled_count := settled_count + 1;
    exception when others then
      failed_count := failed_count + 1;
      update public.upload_sales_import_batches
      set settlement_error = sqlerrm, updated_at = now()
      where id = pending_batch.id;
    end;
  end loop;

  return jsonb_build_object('settled', settled_count, 'failed', failed_count);
end;
$$;

revoke execute on function public.settle_pending_mob_sales_import_batches() from public, anon, authenticated;
revoke execute on function public.settle_mob_sales_import_batch(uuid, text) from public, anon;
grant execute on function public.settle_mob_sales_import_batch(uuid, text) to authenticated;
revoke execute on function public.post_upload_sales_import_batch(uuid, text) from public, anon;
grant execute on function public.post_upload_sales_import_batch(uuid, text) to authenticated;

create or replace function public.retry_upload_sales_import_batch(
  p_batch_id uuid,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_batch public.upload_sales_import_batches%rowtype;
  import_line public.upload_sales_import_lines%rowtype;
  storage_row record;
  temporary_sales_row record;
  remaining_qty integer;
  take_qty integer;
  line_applied integer;
  line_skipped integer;
  total_applied integer := 0;
  total_skipped integer := 0;
  shortage_lines integer := 0;
  actor_email text := nullif(trim(coalesce(p_actor_email, '')), '');
  normalized_sku text;
  normalized_size text;
  allow_any_size boolean;
begin
  select *
    into target_batch
  from public.upload_sales_import_batches
  where id = p_batch_id
  for update;

  if target_batch.id is null then
    raise exception 'Shelving sales import batch not found';
  end if;

  if target_batch.status <> 'posted' then
    raise exception 'Only posted shelving import batches can retry skipped quantities. Current status: %', target_batch.status;
  end if;

  perform public.expand_upload_bundle_lines(p_batch_id);

  if exists (
    select 1 from public.upload_sales_import_lines line
    where line.batch_id = p_batch_id and line.included = true and line.skipped_qty > 0
      and regexp_replace(upper(coalesce(line.sku_id, '')), '[^A-Z0-9]', '', 'g') ~ '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}$'
  ) then
    perform public.retry_arkline_sales_import_batch(p_batch_id, actor_email);
  end if;

  for import_line in
    select *
    from public.upload_sales_import_lines
    where batch_id = p_batch_id
      and included = true
      and coalesce(skipped_qty, 0) > 0
    order by row_number asc, id asc
    for update
  loop
    remaining_qty := import_line.skipped_qty;
    line_applied := 0;
    normalized_sku := upper(regexp_replace(coalesce(import_line.sku_id, ''), '[^A-Z0-9]', '', 'g'));
    if normalized_sku ~ '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}$' then
      continue;
    end if;
    normalized_size := upper(regexp_replace(coalesce(import_line.size, ''), '[^A-Z0-9]', '', 'g'));
    if normalized_size = '' then
      normalized_size := '-';
    end if;

    select normalized_size = '-' and exists (
      select 1 from public.product_bundles b
      where b.status in ('draft', 'released')
        and regexp_replace(upper(coalesce(b.bundle_code, '')), '[^A-Z0-9]', '', 'g') = normalized_sku
    ) into allow_any_size;

    if normalized_sku = '' then
      continue;
    end if;

    -- Temporary Sales is always checked first, regardless of its original
    -- source location. Shelving is used only for the remaining quantity.
    for temporary_sales_row in
      select
        temporary_item.id,
        temporary_item.sku_id,
        temporary_item.item_name,
        temporary_item.size,
        temporary_item.qty_in_area,
        temporary_item.source_location_label,
        temporary_item.entered_at
      from public.warehouse_temporary_sales_items temporary_item
      where temporary_item.status = 'IN_TEMPORARY_AREA'
          and coalesce(temporary_item.area_type, 'SALES') = 'SALES'
          and coalesce(nullif(upper(trim(temporary_item.group_code)), ''), 'MOB') = coalesce(nullif(upper(trim(target_batch.group_code)), ''), 'MOB')
        and coalesce(temporary_item.qty_in_area, 0) > 0
        and public.upload_stock_sku_tokens(temporary_item.sku_id, temporary_item.source_variant_code, temporary_item.item_name)
          @> array[normalized_sku]
        and (
          allow_any_size
          or public.warehouse_sizes_match(temporary_item.size, import_line.size, import_line.variation_raw)
        )
      order by temporary_item.entered_at asc nulls first, temporary_item.id asc
      for update of temporary_item
    loop
      exit when remaining_qty <= 0;

      take_qty := least(remaining_qty, coalesce(temporary_sales_row.qty_in_area, 0));
      if take_qty <= 0 then
        continue;
      end if;

      insert into public.upload_warehouse_storage_movements (
        source_type, source_batch_id, source_line_id, temporary_sales_item_id,
        movement_type, warehouse_storage_id, rack_location_id, location_snapshot,
        sku_id, item_name_snapshot, size, qty_before, qty_delta, qty_after,
        storage_row_deleted, reference_number, created_by, notes
      ) values (
        'upload_sales_import', p_batch_id, import_line.id, temporary_sales_row.id,
        'OUT', null, null,
        jsonb_build_object(
          'source', 'Temporary Sales Area',
          'source_location_label', temporary_sales_row.source_location_label
        ),
        temporary_sales_row.sku_id, temporary_sales_row.item_name, temporary_sales_row.size,
        temporary_sales_row.qty_in_area, -take_qty,
        temporary_sales_row.qty_in_area - take_qty,
        false, import_line.order_number, actor_email,
        'Retry skipped sales quantity deducted Temporary Sales Area stock'
      );

      update public.warehouse_temporary_sales_items
      set
        qty_in_area = temporary_sales_row.qty_in_area - take_qty,
        status = case when temporary_sales_row.qty_in_area = take_qty then 'COMPLETED' else 'IN_TEMPORARY_AREA' end,
        updated_at = now()
      where id = temporary_sales_row.id;

      remaining_qty := remaining_qty - take_qty;
      line_applied := line_applied + take_qty;
    end loop;

    for storage_row in
      select
        storage.id,
        storage.rack_location_id,
        storage.sku_id,
        storage.item_name,
        storage.size,
        storage.qty,
        jsonb_build_object(
          'rack_location_id', location.id,
          'location_type', location.location_type,
          'location_id', location.location_id,
          'location_code', location.location_code,
          'sub_location', location.sub_location,
          'location_name', location.location_name,
          'group_code', location.group_code
        ) as location_snapshot
      from public.warehouse_storage storage
      join public.dir_rack_locations location
        on location.id = storage.rack_location_id
      where upper(trim(coalesce(location.location_type, ''))) = 'SHELVING'
        and coalesce(nullif(upper(trim(location.group_code)), ''), 'MOB') = coalesce(nullif(upper(trim(target_batch.group_code)), ''), 'MOB')
        and coalesce(storage.qty, 0) > 0
        and public.upload_stock_sku_tokens(storage.sku_id, storage.source_variant_code, storage.item_name)
          @> array[normalized_sku]
        and (
          allow_any_size
          or public.warehouse_sizes_match(storage.size, import_line.size, import_line.variation_raw)
        )
      order by storage.created_at asc nulls first, storage.id asc
      for update of storage
    loop
      exit when remaining_qty <= 0;

      take_qty := least(remaining_qty, coalesce(storage_row.qty, 0));
      if take_qty <= 0 then
        continue;
      end if;

      insert into public.upload_warehouse_storage_movements (
        source_type, source_batch_id, source_line_id, movement_type,
        warehouse_storage_id, rack_location_id, location_snapshot, sku_id,
        item_name_snapshot, size, qty_before, qty_delta, qty_after,
        storage_row_deleted, reference_number, created_by, notes
      ) values (
        'upload_sales_import', p_batch_id, import_line.id, 'OUT',
        storage_row.id, storage_row.rack_location_id, storage_row.location_snapshot,
        storage_row.sku_id, storage_row.item_name, storage_row.size, storage_row.qty,
        -take_qty, storage_row.qty - take_qty,
        storage_row.qty = take_qty
          and not (
            upper(trim(coalesce(storage_row.location_snapshot->>'location_type', ''))) = 'SHELVING'
            and upper(trim(coalesce(storage_row.location_snapshot->>'group_code', ''))) = 'ARKLINE'
          ),
        import_line.order_number, actor_email, 'Retry skipped sales quantity from shelving'
      );

      if storage_row.qty = take_qty then
        if upper(trim(coalesce(storage_row.location_snapshot->>'location_type', ''))) = 'SHELVING'
           and upper(trim(coalesce(storage_row.location_snapshot->>'group_code', ''))) = 'ARKLINE' then
          update public.warehouse_storage
          set qty = 0, updated_by = actor_email, updated_at = now()
          where id = storage_row.id;
        else
          delete from public.warehouse_storage where id = storage_row.id;
        end if;
      else
        update public.warehouse_storage
        set
          qty = storage_row.qty - take_qty,
          updated_by = actor_email,
          updated_at = now()
        where id = storage_row.id;
      end if;

      remaining_qty := remaining_qty - take_qty;
      line_applied := line_applied + take_qty;
    end loop;

    line_skipped := greatest(remaining_qty, 0);

    update public.upload_sales_import_lines
    set
      applied_qty = coalesce(applied_qty, 0) + line_applied,
      skipped_qty = line_skipped,
      available_qty_snapshot = greatest(coalesce(available_qty_snapshot, 0), line_applied),
      exclusion_reason = case when line_skipped > 0 then 'Insufficient shelving stock' else null end
    where id = import_line.id;

    if line_skipped > 0 then
      shortage_lines := shortage_lines + 1;
    end if;
  end loop;

  select
    coalesce(sum(applied_qty), 0),
    coalesce(sum(skipped_qty), 0)
    into total_applied, total_skipped
  from public.upload_sales_import_lines
  where batch_id = p_batch_id;

  select count(*)
    into shortage_lines
  from public.upload_sales_import_lines
  where batch_id = p_batch_id
    and included = true
    and coalesce(skipped_qty, 0) > 0;

  update public.upload_sales_import_batches
  set
    applied_qty = total_applied,
    skipped_qty = total_skipped,
    shortage_line_count = shortage_lines,
    updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'posted',
    'retried_skipped_only', true,
    'applied_qty', total_applied,
    'skipped_qty', total_skipped,
    'shortage_line_count', shortage_lines
  );
end;
$$;

create or replace function public.reverse_mob_sales_import_batch(
  p_batch_id uuid,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_batch public.upload_sales_import_batches%rowtype;
  offset_row record;
  result jsonb;
  actor_email text := nullif(trim(coalesce(p_actor_email, '')), '');
begin
  if not public.arkline_upload_can_manage() then
    raise exception 'Not allowed to reverse MOB uploads';
  end if;

  select * into target_batch
  from public.upload_sales_import_batches
  where id = p_batch_id
  for update;

  if target_batch.id is null or target_batch.group_code <> 'MOB' then
    raise exception 'MOB upload batch not found';
  end if;

  if target_batch.status = 'pending_settlement' then
    update public.upload_sales_import_batches
    set status = 'cancelled',
        cancelled_by = actor_email,
        cancelled_at = now(),
        settlement_error = null,
        raw_retention_until = now() + interval '7 days',
        updated_at = now()
    where id = p_batch_id;
    return jsonb_build_object('batch_id', p_batch_id, 'status', 'cancelled', 'reversed_qty', 0);
  end if;

  result := public.reverse_upload_sales_import_batch(p_batch_id, actor_email);

  for offset_row in
    select * from public.upload_arkline_pick_offsets
    where batch_id = p_batch_id and reversed_at is null
    for update
  loop
    update public.restock_request
    set sales_upload_credited_qty = greatest(0, sales_upload_credited_qty - offset_row.qty)
    where id = offset_row.restock_request_id;

    update public.upload_arkline_pick_offsets
    set reversed_at = now()
    where id = offset_row.id;
  end loop;

  return result;
end;
$$;

revoke execute on function public.reverse_mob_sales_import_batch(uuid, text) from public, anon;
grant execute on function public.reverse_mob_sales_import_batch(uuid, text) to authenticated;
