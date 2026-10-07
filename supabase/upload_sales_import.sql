create extension if not exists pgcrypto;

create sequence if not exists public.upload_sales_import_batch_seq;

create table if not exists public.upload_sales_import_batches (
  id uuid primary key default gen_random_uuid(),
  batch_number text not null default (
    'SSU-' ||
    to_char((now() at time zone 'Asia/Jakarta'), 'YYYYMMDD') ||
    '-' ||
    lpad(nextval('public.upload_sales_import_batch_seq'::regclass)::text, 4, '0')
  ),
  file_name text,
  file_hash text,
  source_channel text not null default 'jubelio',
  status text not null default 'draft',
  valid_statuses text[] not null default array['packaged', 'ship', 'shipped'],
  uploaded_by text,
  uploaded_at timestamp with time zone not null default now(),
  posted_by text,
  posted_at timestamp with time zone,
  reversed_by text,
  reversed_at timestamp with time zone,
  total_csv_rows integer not null default 0,
  order_count integer not null default 0,
  total_order_lines integer not null default 0,
  included_lines integer not null default 0,
  excluded_lines integer not null default 0,
  requested_qty integer not null default 0,
  applied_qty integer not null default 0,
  skipped_qty integer not null default 0,
  duplicate_order_count integer not null default 0,
  shortage_line_count integer not null default 0,
  missing_sku_count integer not null default 0,
  raw_retention_until timestamp with time zone not null default (now() + interval '7 days'),
  raw_purged_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint upload_sales_import_batches_batch_number_key unique (batch_number),
  constraint upload_sales_import_batches_file_hash_key unique (file_hash),
  constraint upload_sales_import_batches_status_check
    check (status in ('draft', 'posted', 'cancelled', 'reversed')),
  constraint upload_sales_import_batches_qty_check
    check (
      total_csv_rows >= 0
      and order_count >= 0
      and total_order_lines >= 0
      and included_lines >= 0
      and excluded_lines >= 0
      and requested_qty >= 0
      and applied_qty >= 0
      and skipped_qty >= 0
      and duplicate_order_count >= 0
      and shortage_line_count >= 0
      and missing_sku_count >= 0
    )
);

alter table public.upload_sales_import_batches
  add column if not exists order_count integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.upload_sales_import_batches'::regclass
      and conname = 'upload_sales_import_batches_order_count_check'
  ) then
    alter table public.upload_sales_import_batches
      add constraint upload_sales_import_batches_order_count_check
      check (order_count >= 0);
  end if;
end $$;

update public.upload_sales_import_batches batches
set order_count = coalesce(summary.order_count, 0)
from (
  select
    batch_id,
    count(distinct nullif(trim(order_number), ''))::integer as order_count
  from public.upload_sales_import_lines
  group by batch_id
) summary
where batches.id = summary.batch_id
;

create table if not exists public.upload_sales_import_lines (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.upload_sales_import_batches(id) on update cascade on delete cascade,
  row_number integer not null,
  order_number text,
  order_status text,
  sku_id text,
  product_name text,
  variation_raw text,
  size text,
  qty integer not null default 0,
  included boolean not null default false,
  exclusion_reason text,
  available_qty_snapshot integer not null default 0,
  applied_qty integer not null default 0,
  skipped_qty integer not null default 0,
  created_at timestamp with time zone not null default now(),
  constraint upload_sales_import_lines_qty_check
    check (
      row_number > 0
      and qty >= 0
      and available_qty_snapshot >= 0
      and applied_qty >= 0
      and skipped_qty >= 0
    )
);

create table if not exists public.upload_warehouse_storage_movements (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_batch_id uuid,
  source_line_id uuid,
  temporary_sales_item_id bigint,
  movement_type text not null,
  warehouse_storage_id bigint,
  rack_location_id bigint,
  location_snapshot jsonb not null default '{}'::jsonb,
  sku_id text,
  item_name_snapshot text,
  size text,
  qty_before integer not null default 0,
  qty_delta integer not null,
  qty_after integer not null default 0,
  storage_row_deleted boolean not null default false,
  reference_number text,
  created_by text,
  created_at timestamp with time zone not null default now(),
  notes text,
  constraint upload_warehouse_storage_movements_type_check
    check (movement_type in ('OUT', 'IN', 'REVERSE')),
  constraint upload_warehouse_storage_movements_qty_check
    check (qty_before >= 0 and qty_after >= 0 and qty_delta <> 0)
);

create index if not exists upload_sales_import_batches_status_idx
  on public.upload_sales_import_batches (status, uploaded_at desc);

create index if not exists upload_sales_import_batches_hash_idx
  on public.upload_sales_import_batches (file_hash);

create index if not exists upload_sales_import_lines_batch_idx
  on public.upload_sales_import_lines (batch_id, row_number);

create index if not exists upload_sales_import_lines_lookup_idx
  on public.upload_sales_import_lines (batch_id, included, sku_id, size);

create index if not exists upload_warehouse_storage_movements_batch_idx
  on public.upload_warehouse_storage_movements (source_batch_id, created_at);

create index if not exists upload_warehouse_storage_movements_storage_idx
  on public.upload_warehouse_storage_movements (warehouse_storage_id, created_at desc);

alter table public.upload_warehouse_storage_movements
  add column if not exists temporary_sales_item_id bigint;

create index if not exists upload_warehouse_storage_movements_temporary_item_idx
  on public.upload_warehouse_storage_movements (temporary_sales_item_id, created_at desc);

create or replace function public.set_upload_sales_import_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Expand a sales-upload bundle into its component rows only when no direct
-- bundle stock exists. The existing post/retry stock deduction then handles
-- those generated component rows exactly like ordinary SKU rows.
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
begin
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
    where regexp_replace(upper(coalesce(stock.sku_id, '')), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(v_bundle_code), '[^A-Z0-9]', '', 'g')
      and (coalesce(nullif(trim(source_line.size), ''), '-') = '-'
        or coalesce(nullif(trim(stock.size), ''), '-') = coalesce(nullif(trim(source_line.size), ''), '-'));

    select direct_qty + coalesce(sum(temp.qty_in_area), 0)
      into direct_qty
    from public.warehouse_temporary_sales_items temp
    where temp.status = 'IN_TEMPORARY_AREA'
      and coalesce(temp.area_type, 'SALES') = 'SALES'
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
        product_name, variation_raw, size, qty, included, exclusion_reason
      ) values (
        source_line.batch_id, next_row, source_line.order_number, source_line.order_status,
        component.sku, coalesce(component.product_name, component.sku),
        'Expanded from bundle ' || v_bundle_code, coalesce(component.size_label, source_line.size),
        component_qty::integer, true, null
      );
    end loop;

    update public.upload_sales_import_lines
    set included = false,
        exclusion_reason = 'Expanded into component SKU rows'
    where id = source_line.id;
  end loop;
end;
$$;

drop trigger if exists upload_sales_import_batches_set_updated_at
  on public.upload_sales_import_batches;

create trigger upload_sales_import_batches_set_updated_at
before update on public.upload_sales_import_batches
for each row
execute function public.set_upload_sales_import_updated_at();

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

  if target_batch.status <> 'draft' then
    raise exception 'Only draft shelving import batches can be posted. Current status: %', target_batch.status;
  end if;

  perform public.expand_upload_bundle_lines(p_batch_id);

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
          and coalesce(temporary_item.qty_in_area, 0) > 0
          and exists (
            select 1
            from regexp_split_to_table(
              concat_ws(' ', temporary_item.sku_id, temporary_item.source_variant_code, temporary_item.item_name),
              '[[:space:]|,;/]+'
            ) as sku_token(raw_value)
            where upper(regexp_replace(coalesce(sku_token.raw_value, ''), '[^A-Z0-9]', '', 'g')) = normalized_sku
          )
          and (
            allow_any_size
            or coalesce(nullif(regexp_replace(upper(coalesce(temporary_item.size, '')), '[^A-Z0-9]', '', 'g'), ''), '-') = normalized_size
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
        and coalesce(storage.qty, 0) > 0
        and exists (
          select 1
          from regexp_split_to_table(concat_ws(' ', storage.sku_id, storage.source_variant_code, storage.item_name), '[[:space:]|,;/]+') as sku_token(raw_value)
          where upper(regexp_replace(coalesce(sku_token.raw_value, ''), '[^A-Z0-9]', '', 'g')) = normalized_sku
        )
        and (
          allow_any_size
          or coalesce(nullif(regexp_replace(upper(coalesce(storage.size, '')), '[^A-Z0-9]', '', 'g'), ''), '-') = normalized_size
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
        storage_row.qty = take_qty,
        import_line.order_number,
        actor_email,
        'Daily shelving sales upload'
      );

      if storage_row.qty = take_qty then
        delete from public.warehouse_storage
        where id = storage_row.id;
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
    posted_by = actor_email,
    posted_at = now(),
    applied_qty = total_applied,
    skipped_qty = total_skipped,
    shortage_line_count = shortage_lines
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'posted',
    'applied_qty', total_applied,
    'skipped_qty', total_skipped,
    'shortage_line_count', shortage_lines
  );
end;
$$;

-- Retry only the quantity that was skipped by an already-posted batch.
-- Previously applied quantities are never replayed, so shelving stock is not
-- deducted twice when newer Temporary Sales or shelving stock is available.
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
        and coalesce(temporary_item.qty_in_area, 0) > 0
        and exists (
          select 1
          from regexp_split_to_table(
            concat_ws(' ', temporary_item.sku_id, temporary_item.source_variant_code, temporary_item.item_name),
            '[[:space:]|,;/]+'
          ) as sku_token(raw_value)
          where upper(regexp_replace(coalesce(sku_token.raw_value, ''), '[^A-Z0-9]', '', 'g')) = normalized_sku
        )
        and (
          allow_any_size
          or coalesce(nullif(regexp_replace(upper(coalesce(temporary_item.size, '')), '[^A-Z0-9]', '', 'g'), ''), '-') = normalized_size
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
        and coalesce(storage.qty, 0) > 0
        and exists (
          select 1
          from regexp_split_to_table(concat_ws(' ', storage.sku_id, storage.source_variant_code, storage.item_name), '[[:space:]|,;/]+') as sku_token(raw_value)
          where upper(regexp_replace(coalesce(sku_token.raw_value, ''), '[^A-Z0-9]', '', 'g')) = normalized_sku
        )
        and (
          allow_any_size
          or coalesce(nullif(regexp_replace(upper(coalesce(storage.size, '')), '[^A-Z0-9]', '', 'g'), ''), '-') = normalized_size
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
        -take_qty, storage_row.qty - take_qty, storage_row.qty = take_qty,
        import_line.order_number, actor_email, 'Retry skipped sales quantity from shelving'
      );

      if storage_row.qty = take_qty then
        delete from public.warehouse_storage where id = storage_row.id;
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

create or replace function public.reverse_upload_sales_import_batch(
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
  movement_row public.upload_warehouse_storage_movements%rowtype;
  storage_row public.warehouse_storage%rowtype;
  temporary_sales_row public.warehouse_temporary_sales_items%rowtype;
  restored_qty integer;
  target_storage_id bigint;
  actor_email text := nullif(trim(coalesce(p_actor_email, '')), '');
  reversed_qty integer := 0;
  restored_rows integer := 0;
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
    raise exception 'Only posted shelving import batches can be reversed. Current status: %', target_batch.status;
  end if;

  if exists (
    select 1
    from public.upload_warehouse_storage_movements
    where source_batch_id = p_batch_id
      and movement_type = 'REVERSE'
  ) then
    raise exception 'This shelving import batch has already been reversed';
  end if;

  for movement_row in
    select *
    from public.upload_warehouse_storage_movements
    where source_batch_id = p_batch_id
      and movement_type = 'OUT'
    order by created_at desc, id desc
  loop
    restored_qty := abs(movement_row.qty_delta);

    if movement_row.temporary_sales_item_id is not null then
      select *
        into temporary_sales_row
      from public.warehouse_temporary_sales_items
      where id = movement_row.temporary_sales_item_id
      for update;

      if temporary_sales_row.id is null then
        raise exception 'Temporary Sales item % no longer exists and cannot be restored', movement_row.temporary_sales_item_id;
      end if;

      update public.warehouse_temporary_sales_items
      set
        qty_in_area = coalesce(temporary_sales_row.qty_in_area, 0) + restored_qty,
        status = 'IN_TEMPORARY_AREA',
        updated_at = now()
      where id = temporary_sales_row.id;

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
        movement_row.source_line_id,
        temporary_sales_row.id,
        'REVERSE',
        null,
        null,
        coalesce(movement_row.location_snapshot, '{}'::jsonb),
        movement_row.sku_id,
        movement_row.item_name_snapshot,
        movement_row.size,
        coalesce(temporary_sales_row.qty_in_area, 0),
        restored_qty,
        coalesce(temporary_sales_row.qty_in_area, 0) + restored_qty,
        false,
        movement_row.reference_number,
        actor_email,
        'Reverse daily sales upload deduction from Temporary Sales Area'
      );

      reversed_qty := reversed_qty + restored_qty;
      continue;
    end if;

    target_storage_id := movement_row.warehouse_storage_id;

    select *
      into storage_row
    from public.warehouse_storage
    where id = target_storage_id
    for update;

    if storage_row.id is null then
      insert into public.warehouse_storage (
        rack_location_id,
        sku_id,
        item_name,
        size,
        qty,
        notes,
        updated_by,
        updated_at
      ) values (
        movement_row.rack_location_id,
        movement_row.sku_id,
        coalesce(movement_row.item_name_snapshot, movement_row.sku_id, 'Restored item'),
        movement_row.size,
        restored_qty,
        'Restored from reversed shelving upload batch ' || target_batch.batch_number,
        actor_email,
        now()
      )
      returning * into storage_row;

      target_storage_id := storage_row.id;
      restored_rows := restored_rows + 1;

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
        movement_row.source_line_id,
        'REVERSE',
        target_storage_id,
        movement_row.rack_location_id,
        coalesce(movement_row.location_snapshot, '{}'::jsonb),
        movement_row.sku_id,
        movement_row.item_name_snapshot,
        movement_row.size,
        0,
        restored_qty,
        restored_qty,
        false,
        movement_row.reference_number,
        actor_email,
        'Reverse daily shelving sales upload; recreated deleted storage row'
      );
    else
      update public.warehouse_storage
      set
        qty = coalesce(storage_row.qty, 0) + restored_qty,
        updated_by = actor_email,
        updated_at = now()
      where id = storage_row.id
      returning * into storage_row;

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
        movement_row.source_line_id,
        'REVERSE',
        storage_row.id,
        movement_row.rack_location_id,
        coalesce(movement_row.location_snapshot, '{}'::jsonb),
        movement_row.sku_id,
        movement_row.item_name_snapshot,
        movement_row.size,
        storage_row.qty - restored_qty,
        restored_qty,
        storage_row.qty,
        false,
        movement_row.reference_number,
        actor_email,
        'Reverse daily shelving sales upload'
      );
    end if;

    reversed_qty := reversed_qty + restored_qty;
  end loop;

  update public.upload_sales_import_batches
  set
    status = 'reversed',
    reversed_by = actor_email,
    reversed_at = now()
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'reversed',
    'reversed_qty', reversed_qty,
    'restored_rows', restored_rows
  );
end;
$$;

create or replace function public.delete_upload_sales_import_batch(
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
  deleted_line_count integer := 0;
begin
  select *
    into target_batch
  from public.upload_sales_import_batches
  where id = p_batch_id
  for update;

  if target_batch.id is null then
    raise exception 'Upload batch not found';
  end if;

  if target_batch.status <> 'draft' then
    raise exception 'Only draft upload batches can be deleted. Reverse posted batches instead.';
  end if;

  delete from public.upload_sales_import_lines
  where batch_id = p_batch_id;
  get diagnostics deleted_line_count = row_count;

  delete from public.upload_sales_import_batches
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'deleted',
    'deleted_lines', deleted_line_count,
    'deleted_by', nullif(trim(coalesce(p_actor_email, '')), '')
  );
end;
$$;

create or replace function public.purge_upload_sales_import_raw_lines()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expired_batch_count integer := 0;
  purged_movement_count integer := 0;
  purged_line_count integer := 0;
  purged_batch_count integer := 0;
begin
  select count(*)
  into expired_batch_count
  from public.upload_sales_import_batches
  where raw_retention_until < now();

  -- Remove movement history first so the three upload tables expire together.
  delete from public.upload_warehouse_storage_movements movements
  where movements.source_batch_id in (
    select id
    from public.upload_sales_import_batches
    where raw_retention_until < now()
  );
  get diagnostics purged_movement_count = row_count;

  delete from public.upload_sales_import_lines lines
  where lines.batch_id in (
    select id
    from public.upload_sales_import_batches
    where raw_retention_until < now()
  );
  get diagnostics purged_line_count = row_count;

  delete from public.upload_sales_import_batches
  where raw_retention_until < now();
  get diagnostics purged_batch_count = row_count;

  return jsonb_build_object(
    'expired_batches', expired_batch_count,
    'purged_movements', purged_movement_count,
    'purged_lines', purged_line_count,
    'purged_batches', purged_batch_count
  );
end;
$$;

alter table public.upload_sales_import_batches enable row level security;
alter table public.upload_sales_import_lines enable row level security;
alter table public.upload_warehouse_storage_movements enable row level security;

grant select, insert, update, delete on public.upload_sales_import_batches to authenticated;
grant select, insert, update, delete on public.upload_sales_import_lines to authenticated;
grant select, insert, update, delete on public.upload_warehouse_storage_movements to authenticated;
grant usage, select on sequence public.upload_sales_import_batch_seq to authenticated;
grant execute on function public.post_upload_sales_import_batch(uuid, text) to authenticated;
grant execute on function public.expand_upload_bundle_lines(uuid) to authenticated;
grant execute on function public.retry_upload_sales_import_batch(uuid, text) to authenticated;
grant execute on function public.reverse_upload_sales_import_batch(uuid, text) to authenticated;
grant execute on function public.delete_upload_sales_import_batch(uuid, text) to authenticated;
grant execute on function public.purge_upload_sales_import_raw_lines() to authenticated;

drop policy if exists upload_sales_import_batches_authenticated_all
  on public.upload_sales_import_batches;
create policy upload_sales_import_batches_authenticated_all
on public.upload_sales_import_batches
for all
to authenticated
using (true)
with check (true);

drop policy if exists upload_sales_import_lines_authenticated_all
  on public.upload_sales_import_lines;
create policy upload_sales_import_lines_authenticated_all
on public.upload_sales_import_lines
for all
to authenticated
using (true)
with check (true);

drop policy if exists upload_warehouse_storage_movements_authenticated_all
  on public.upload_warehouse_storage_movements;
create policy upload_warehouse_storage_movements_authenticated_all
on public.upload_warehouse_storage_movements
for all
to authenticated
using (true)
with check (true);

insert into public.dir_user_permissions (code, label, description)
values
  ('storage.shelving_upload.view', 'View Shelving Upload', 'View daily shelving sales upload batches.'),
  ('storage.shelving_upload.add', 'Add Shelving Upload', 'Upload and preview daily shelving sales CSV files.'),
  ('storage.shelving_upload.edit', 'Edit Shelving Upload', 'Post, reverse, and manage daily shelving sales upload batches.')
on conflict (code) do update
set
  label = excluded.label,
  description = excluded.description;

insert into public.dir_user_roles (role, permission_code)
values
  ('warehouse_leader', 'storage.shelving_upload.view'),
  ('warehouse_leader', 'storage.shelving_upload.add'),
  ('warehouse_leader', 'storage.shelving_upload.edit'),
  ('storage_coordinator', 'storage.shelving_upload.view'),
  ('storage_coordinator', 'storage.shelving_upload.add'),
  ('storage_coordinator', 'storage.shelving_upload.edit'),
  ('mob_cs', 'storage.shelving_upload.view'),
  ('mob_cs', 'storage.shelving_upload.add'),
  ('mob_cs', 'storage.shelving_upload.edit'),
  ('oi_cs', 'storage.shelving_upload.view'),
  ('oi_cs', 'storage.shelving_upload.add'),
  ('oi_cs', 'storage.shelving_upload.edit'),
  ('arkline_cs', 'storage.shelving_upload.view'),
  ('arkline_cs', 'storage.shelving_upload.add'),
  ('arkline_cs', 'storage.shelving_upload.edit')
on conflict do nothing;
