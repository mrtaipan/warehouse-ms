-- Run after restock_request_owner_edit.sql, warehouse_temporary_sales.sql,
-- warehouse_stock_size_matching.sql, and delivery_return_completion.sql.
-- Priority return cases stage replacement stock in Temp. Retur Keeping.

alter table public.restock_request
  add column if not exists destination_area text not null default 'PICKER',
  add column if not exists return_case_id bigint references public.delivery_error_retur_cases(id) on delete restrict,
  add column if not exists return_line_no integer;

alter table public.restock_request
  drop constraint if exists restock_request_destination_area_check;
alter table public.restock_request
  add constraint restock_request_destination_area_check
  check (destination_area in ('PICKER', 'RETUR_KEEPING'));

alter table public.restock_request
  drop constraint if exists restock_request_request_status_check;
alter table public.restock_request
  add constraint restock_request_request_status_check
  check (request_status in ('open', 'completed', 'cancelled'));

create unique index if not exists restock_request_return_line_uidx
  on public.restock_request (return_case_id, return_line_no)
  where return_case_id is not null;

alter table public.warehouse_temporary_sales_items
  add column if not exists restock_request_id uuid
  references public.restock_request(id) on delete restrict;

create unique index if not exists warehouse_temporary_restock_request_uidx
  on public.warehouse_temporary_sales_items (restock_request_id)
  where restock_request_id is not null;

create index if not exists warehouse_temporary_priority_source_idx
  on public.warehouse_temporary_sales_items (group_code, area_type, status)
  where qty_in_area > 0;

-- A case trigger is the only writer allowed to create or reconcile linked requests.
create or replace function public.restock_request_guard_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  can_manage_upload boolean;
  can_manage_restock boolean;
  sync_case_id text := current_setting('warehouse.priority_return_case_id', true);
begin
  if actor_id is null then
    if current_user = 'postgres' and tg_op = 'INSERT'
      and current_setting('warehouse.priority_return_backfill', true) = 'on'
      and new.destination_area = 'RETUR_KEEPING' then
      return new;
    end if;
    if current_user = 'postgres' and tg_op = 'UPDATE' then
      if old.request_status = 'completed'
        and new.request_status = 'completed'
        and to_jsonb(new) - 'sales_upload_credited_qty'
          is not distinct from to_jsonb(old) - 'sales_upload_credited_qty' then
        return new;
      end if;
    end if;
    raise exception 'Authentication is required for restock request changes.' using errcode = '42501';
  end if;

  if pg_trigger_depth() > 1 and sync_case_id is not null then
    if tg_op = 'DELETE' and sync_case_id = old.return_case_id::text
      and old.destination_area = 'RETUR_KEEPING' then
      return old;
    end if;
    if tg_op <> 'DELETE' and sync_case_id = new.return_case_id::text
      and new.destination_area = 'RETUR_KEEPING' then
      return new;
    end if;
  end if;

  if tg_op = 'INSERT' then
    if new.destination_area <> 'PICKER' or new.return_case_id is not null then
      raise exception 'Only a priority return case can create a linked request.' using errcode = '42501';
    end if;
    new.requester_user_id := coalesce(new.requester_user_id, actor_id);
    if new.requester_user_id is distinct from actor_id or new.request_status <> 'open' then
      raise exception 'A restock request must be created by its owner as open.' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.destination_area <> 'PICKER' or old.request_status <> 'open'
      or old.requester_user_id is distinct from actor_id then
      raise exception 'Only the requester can delete an open request.' using errcode = '42501';
    end if;
    return old;
  end if;

  if old.request_status = 'open' and new.request_status = 'open' then
    if old.destination_area = 'RETUR_KEEPING' then
      raise exception 'Edit the return case to change a linked priority request.' using errcode = '42501';
    end if;
    select exists (
      select 1 from public.dir_user_profiles profile
      left join public.dir_user_roles role_map on role_map.role = profile.role
      where profile.authenticated_id = actor_id
        and (profile.role = 'admin' or role_map.permission_code = 'storage.restock_picker.edit')
    ) into can_manage_restock;

    if can_manage_restock
      and lower(btrim(coalesce(old.take_from, ''))) = 'location is not found'
      and to_jsonb(new) - 'take_from' is not distinct from to_jsonb(old) - 'take_from' then
      return new;
    end if;

    if old.requester_user_id is distinct from actor_id
      or to_jsonb(new) - array['item_name', 'size', 'qty', 'take_from', 'search_term', 'source_type', 'note']
        is distinct from
        to_jsonb(old) - array['item_name', 'size', 'qty', 'take_from', 'search_term', 'source_type', 'note'] then
      raise exception 'Only the requester can edit an open request.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.request_status = 'open' and new.request_status = 'completed' then
    if old.destination_area = 'RETUR_KEEPING'
      and current_setting('warehouse.priority_completion_request_id', true) is distinct from old.id::text then
      raise exception 'Use priority return completion to stage the replacement stock.' using errcode = '42501';
    end if;
    if to_jsonb(new) - array['request_status', 'take_from', 'storage_id', 'completed_at', 'completed_by', 'source_sku_id', 'fulfilled_qty']
      is distinct from
      to_jsonb(old) - array['request_status', 'take_from', 'storage_id', 'completed_at', 'completed_by', 'source_sku_id', 'fulfilled_qty'] then
      raise exception 'Completing a request cannot change its requested item or quantity.' using errcode = '42501';
    end if;
    return new;
  end if;

  if old.request_status = 'completed' and new.request_status = 'completed' then
    select exists (
      select 1 from public.dir_user_profiles profile
      left join public.dir_user_roles role_map on role_map.role = profile.role
      where profile.authenticated_id = actor_id
        and (profile.role = 'admin' or role_map.permission_code = 'storage.shelving_upload.edit')
    ) into can_manage_upload;

    if not can_manage_upload
      or to_jsonb(new) - 'sales_upload_credited_qty'
        is distinct from to_jsonb(old) - 'sales_upload_credited_qty' then
      raise exception 'A completed request is locked.' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'This request status transition is not allowed.' using errcode = '42501';
end;
$$;

drop policy if exists restock_request_authenticated_mutation on public.restock_request;
create policy restock_request_authenticated_mutation
  on public.restock_request for update to authenticated
  using (request_status in ('open', 'completed', 'cancelled'))
  with check (request_status in ('open', 'completed', 'cancelled'));

create or replace function public.sync_priority_return_requests()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item record;
  v_max_line integer := 0;
  v_group text := upper(btrim(coalesce(new.group_order, '')));
begin
  if auth.uid() is null then
    raise exception 'A signed-in user is required to update priority return requests' using errcode = '42501';
  end if;
  perform pg_catalog.set_config('warehouse.priority_return_case_id', new.id::text, true);

  if new.need_prioritized is not true or new.status_barang in ('Cancel', 'Completed')
    or nullif(btrim(new.produk_pengganti), '') is null then
    update public.restock_request
    set request_status = 'cancelled'
    where return_case_id = new.id and destination_area = 'RETUR_KEEPING'
      and request_status = 'open';
    return new;
  end if;

  if v_group not in ('MOB', 'OI', 'ARKLINE') then
    raise exception 'Priority return case has an unsupported group';
  end if;
  if tg_op = 'UPDATE' and (
      new.produk_pengganti is distinct from old.produk_pengganti
      or new.group_order is distinct from old.group_order
    )
    and exists (
      select 1 from public.restock_request
      where return_case_id = new.id and destination_area = 'RETUR_KEEPING'
        and request_status = 'completed'
    ) then
    raise exception 'Replacement products and group cannot change after priority restock is staged';
  end if;

  for v_item in select * from public.delivery_return_product_lines(new.produk_pengganti) loop
    v_max_line := v_item.line_no;
    insert into public.restock_request (
      requester_name, requester_user_id, item_name, size, qty, take_from,
      search_term, source_type, note, request_status, destination_area,
      return_case_id, return_line_no
    ) values (
      coalesce(nullif(btrim(new.created_by), ''), 'Return case ' || new.kode_kejadian),
      auth.uid(), v_item.product_name, v_item.size, v_item.qty,
      'Choose Pallet, Shelving, or Temp. Sales Area',
      coalesce(v_item.sku, v_item.product_name), v_group,
      'Return case ' || new.kode_kejadian || ' | For: Temp. Retur Keeping',
      'open', 'RETUR_KEEPING', new.id, v_item.line_no
    )
    on conflict (return_case_id, return_line_no) where return_case_id is not null
    do update set
      item_name = excluded.item_name,
      size = excluded.size,
      qty = excluded.qty,
      search_term = excluded.search_term,
      source_type = excluded.source_type,
      note = excluded.note,
      request_status = 'open'
    where restock_request.request_status in ('open', 'cancelled');
  end loop;

  update public.restock_request
  set request_status = 'cancelled'
  where return_case_id = new.id and destination_area = 'RETUR_KEEPING'
    and request_status = 'open' and return_line_no > v_max_line;
  return new;
end;
$$;

revoke all on function public.sync_priority_return_requests() from public, anon, authenticated;

drop trigger if exists delivery_case_priority_restock_sync on public.delivery_error_retur_cases;
create trigger delivery_case_priority_restock_sync
after insert or update of need_prioritized, produk_pengganti, group_order, status_barang
on public.delivery_error_retur_cases
for each row execute function public.sync_priority_return_requests();

create or replace function public.priority_return_source_options(p_request_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.restock_request%rowtype;
  v_case public.delivery_error_retur_cases%rowtype;
  v_item record;
  v_options jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.dir_user_profiles profile
    left join public.dir_user_roles role_map on role_map.role = profile.role
    where profile.authenticated_id = auth.uid()
      and (profile.role = 'admin' or role_map.permission_code = 'storage.restock_picker.edit')
  ) then
    raise exception 'Only a restock picker can view priority return sources' using errcode = '42501';
  end if;
  select * into v_request from public.restock_request
  where id = p_request_id and request_status = 'open'
    and destination_area = 'RETUR_KEEPING';
  if not found then raise exception 'Priority return request is not open'; end if;
  select * into v_case from public.delivery_error_retur_cases where id = v_request.return_case_id;
  if not found or v_case.need_prioritized is not true
    or v_case.status_barang in ('Cancel', 'Completed') then
    raise exception 'Return case is no longer active';
  end if;
  select * into v_item from public.delivery_return_product_lines(v_case.produk_pengganti)
  where line_no = v_request.return_line_no;
  if not found then raise exception 'Replacement line is no longer available'; end if;

  select coalesce(jsonb_agg(to_jsonb(option_row) order by option_row.source_kind, option_row.label), '[]'::jsonb)
  into v_options
  from (
    select 'WAREHOUSE'::text as source_kind, stock.id as source_id,
      pg_catalog.concat_ws(' / ', location.location_type, location.location_id,
        location.location_code, nullif(location.sub_location, '')) as label,
      stock.qty as qty, stock.sku_id, stock.item_name, stock.size
    from public.warehouse_storage stock
    join public.dir_rack_locations location on location.id = stock.rack_location_id
    where upper(btrim(location.group_code)) = upper(btrim(v_case.group_order))
      and upper(btrim(location.location_type)) in ('PALLET', 'SHELVING')
      and stock.qty > 0
      and public.delivery_stock_product_matches(stock.sku_id, stock.source_variant_code,
        stock.item_name, v_item.sku, v_item.product_name)
      and public.warehouse_sizes_match(stock.size, v_item.size)
    union all
    select 'TEMP_SALES'::text, temp.id,
      'Temp. Sales Area / ' || temp.id::text,
      temp.qty_in_area, temp.sku_id, temp.item_name, temp.size
    from public.warehouse_temporary_sales_items temp
    where temp.area_type = 'SALES' and temp.status = 'IN_TEMPORARY_AREA'
      and upper(btrim(temp.group_code)) = upper(btrim(v_case.group_order))
      and temp.qty_in_area > 0
      and public.delivery_stock_product_matches(temp.sku_id, temp.source_variant_code,
        temp.item_name, v_item.sku, v_item.product_name)
      and public.warehouse_sizes_match(temp.size, v_item.size)
  ) option_row;
  return v_options;
end;
$$;

revoke all on function public.priority_return_source_options(uuid) from public, anon;
grant execute on function public.priority_return_source_options(uuid) to authenticated;

create or replace function public.complete_priority_return_restock_request(
  p_request_id uuid, p_source_kind text, p_source_id bigint, p_qty integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.restock_request%rowtype;
  v_case public.delivery_error_retur_cases%rowtype;
  v_item record;
  v_stock public.warehouse_storage%rowtype;
  v_temp public.warehouse_temporary_sales_items%rowtype;
  v_location public.dir_rack_locations%rowtype;
  v_source_label text;
  v_sku text;
  v_variant text;
  v_name text;
  v_size text;
  v_category_id bigint;
  v_new_temp_id bigint;
  v_actor text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.dir_user_profiles profile
    left join public.dir_user_roles role_map on role_map.role = profile.role
    where profile.authenticated_id = auth.uid()
      and (profile.role = 'admin' or role_map.permission_code = 'storage.restock_picker.edit')
  ) then
    raise exception 'Only a restock picker can stage priority return stock' using errcode = '42501';
  end if;
  if p_qty is null or p_qty <= 0 or p_source_id is null
    or p_source_kind not in ('WAREHOUSE', 'TEMP_SALES') then
    raise exception 'Choose an available source and a positive whole quantity';
  end if;

  select return_case_id into v_request.return_case_id
  from public.restock_request where id = p_request_id;
  if v_request.return_case_id is null then raise exception 'Priority request was not found'; end if;
  select * into v_case from public.delivery_error_retur_cases
  where id = v_request.return_case_id for update;
  select * into v_request from public.restock_request
  where id = p_request_id and request_status = 'open'
    and destination_area = 'RETUR_KEEPING' for update;
  if not found then raise exception 'Priority request has already been handled'; end if;
  if v_case.need_prioritized is not true
    or v_case.status_barang in ('Cancel', 'Completed') then
    raise exception 'Return case is no longer active';
  end if;
  select * into v_item from public.delivery_return_product_lines(v_case.produk_pengganti)
  where line_no = v_request.return_line_no;
  if not found then raise exception 'Replacement line is no longer available'; end if;

  if p_source_kind = 'WAREHOUSE' then
    select * into v_stock from public.warehouse_storage where id = p_source_id for update;
    select * into v_location from public.dir_rack_locations where id = v_stock.rack_location_id;
    if v_stock.id is null or v_location.id is null
      or upper(btrim(v_location.location_type)) not in ('PALLET', 'SHELVING')
      or upper(btrim(v_location.group_code)) <> upper(btrim(v_case.group_order))
      or v_stock.qty < p_qty
      or not public.delivery_stock_product_matches(v_stock.sku_id, v_stock.source_variant_code,
        v_stock.item_name, v_item.sku, v_item.product_name)
      or not public.warehouse_sizes_match(v_stock.size, v_item.size) then
      raise exception 'Selected warehouse stock is no longer available for this replacement';
    end if;
    v_source_label := pg_catalog.concat_ws(' / ', v_location.location_type,
      v_location.location_id, v_location.location_code, nullif(v_location.sub_location, ''));
    v_sku := v_stock.sku_id;
    v_variant := v_stock.source_variant_code;
    v_name := v_stock.item_name;
    v_size := v_stock.size;
    v_category_id := v_stock.category_id;
    if v_stock.qty = p_qty and not (
      upper(btrim(v_location.group_code)) = 'ARKLINE'
      and upper(btrim(v_location.location_type)) = 'SHELVING'
    ) then
      delete from public.warehouse_storage where id = v_stock.id;
    else
      update public.warehouse_storage
      set qty = qty - p_qty, updated_at = now(), updated_by = coalesce(auth.jwt() ->> 'email', auth.uid()::text)
      where id = v_stock.id;
    end if;
  else
    select * into v_temp from public.warehouse_temporary_sales_items
    where id = p_source_id for update;
    if v_temp.id is null or v_temp.area_type <> 'SALES'
      or v_temp.status <> 'IN_TEMPORARY_AREA'
      or upper(btrim(v_temp.group_code)) <> upper(btrim(v_case.group_order))
      or v_temp.qty_in_area < p_qty
      or not public.delivery_stock_product_matches(v_temp.sku_id, v_temp.source_variant_code,
        v_temp.item_name, v_item.sku, v_item.product_name)
      or not public.warehouse_sizes_match(v_temp.size, v_item.size) then
      raise exception 'Selected Temp. Sales stock is no longer available for this replacement';
    end if;
    v_source_label := 'Temp. Sales Area / ' || v_temp.id::text;
    v_sku := v_temp.sku_id;
    v_variant := v_temp.source_variant_code;
    v_name := v_temp.item_name;
    v_size := v_temp.size;
    v_category_id := v_temp.category_id;
    update public.warehouse_temporary_sales_items
    set qty_in_area = qty_in_area - p_qty,
        status = case when qty_in_area = p_qty then 'COMPLETED' else 'IN_TEMPORARY_AREA' end,
        updated_at = now()
    where id = v_temp.id;
  end if;

  v_actor := coalesce(nullif(auth.jwt() ->> 'email', ''), auth.uid()::text);
  insert into public.warehouse_temporary_sales_items (
    restock_request_id, source_warehouse_storage_id, source_pl_packing_item_id,
    source_variant_code, sku_id, item_name, size, category_id, area_type,
    group_code, source_location_label, qty_in_area, status, entered_at, due_at,
    created_by
  ) values (
    p_request_id, null, null,
    coalesce(v_variant, v_sku), coalesce(v_sku, v_variant, v_item.sku),
    coalesce(v_name, v_item.product_name), coalesce(v_size, v_item.size),
    v_category_id, 'RETUR_KEEPING', upper(btrim(v_case.group_order)),
    v_source_label, p_qty, 'IN_TEMPORARY_AREA', now(), now() + interval '7 days',
    v_actor
  ) returning id into v_new_temp_id;

  insert into public.warehouse_storage_movements (
    warehouse_storage_id, temporary_sales_item_id, movement_type, qty,
    from_location_label, to_location_label, item_name, size, sku_id, created_by
  ) values (
    case when p_source_kind = 'WAREHOUSE' then p_source_id else null end,
    v_new_temp_id, 'TEMPORARY_IN', p_qty, v_source_label, 'Temp. Retur Keeping',
    coalesce(v_name, v_item.product_name), coalesce(v_size, v_item.size),
    coalesce(v_sku, v_variant, v_item.sku), v_actor
  );

  perform pg_catalog.set_config('warehouse.priority_completion_request_id', p_request_id::text, true);
  update public.restock_request
  set request_status = 'completed', completed_at = now(), completed_by = v_actor,
      fulfilled_qty = p_qty, take_from = v_source_label,
      storage_id = case when p_source_kind = 'WAREHOUSE' then p_source_id::text else null end,
      source_sku_id = coalesce(v_sku, v_variant, v_item.sku)
  where id = p_request_id;

  return pg_catalog.jsonb_build_object(
    'request_id', p_request_id, 'temporary_item_id', v_new_temp_id,
    'qty_moved', p_qty, 'source', v_source_label
  );
end;
$$;

revoke all on function public.complete_priority_return_restock_request(uuid, text, bigint, integer)
  from public, anon;
grant execute on function public.complete_priority_return_restock_request(uuid, text, bigint, integer)
  to authenticated;

-- Bring already-prioritized, still-open cases into the same picker queue.
do $$
begin
  perform pg_catalog.set_config('warehouse.priority_return_backfill', 'on', true);
  insert into public.restock_request (
    requester_name, item_name, size, qty, take_from, search_term,
    source_type, note, request_status, destination_area,
    return_case_id, return_line_no
  )
  select coalesce(nullif(btrim(case_row.created_by), ''), 'Return case ' || case_row.kode_kejadian),
    product.product_name, product.size, product.qty,
    'Choose Pallet, Shelving, or Temp. Sales Area',
    coalesce(product.sku, product.product_name), upper(btrim(case_row.group_order)),
    'Return case ' || case_row.kode_kejadian || ' | For: Temp. Retur Keeping',
    'open', 'RETUR_KEEPING', case_row.id, product.line_no
  from public.delivery_error_retur_cases case_row
  cross join lateral public.delivery_return_product_lines(case_row.produk_pengganti) product
  where case_row.need_prioritized is true
    and case_row.status_barang not in ('Cancel', 'Completed')
    and upper(btrim(case_row.group_order)) in ('ARKLINE', 'MOB', 'OI')
  on conflict (return_case_id, return_line_no) where return_case_id is not null
  do nothing;
end;
$$;
