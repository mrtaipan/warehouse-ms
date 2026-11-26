-- Apply after priority_return_restock.sql and restock_arkline_auto_shelving.sql.
-- Only admin and warehouse_leader may remove completed/cancelled picker requests.

alter table public.warehouse_storage_movements
  drop constraint if exists warehouse_storage_movements_type_check;
alter table public.warehouse_storage_movements
  add constraint warehouse_storage_movements_type_check check (movement_type in (
    'STORE_QUEUE', 'MOVE', 'TAKE_OUT', 'TEMPORARY_IN', 'TEMPORARY_RETURN',
    'TEMPORARY_ADJUSTMENT_IN', 'TEMPORARY_ADJUSTMENT_OUT', 'PUTAWAY_IN',
    'CUSTOMER_RETURN_IN', 'CUSTOMER_REPLACEMENT_OUT', 'QC_RECHECK_OUT', 'REJECT_OUT',
    'LOAN_OUT', 'LOAN_RETURN', 'RESTOCK_OUT', 'RESTOCK_REVERSE_IN'
  ));

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
  can_reverse boolean;
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
    if current_setting('warehouse.restock_reverse_request_id', true) = old.id::text then
      select exists (
        select 1 from public.dir_user_profiles profile
        where profile.authenticated_id = actor_id
          and profile.role in ('admin', 'warehouse_leader')
      ) into can_reverse;
      can_reverse := can_reverse or lower(coalesce(auth.jwt()->>'email', '')) = 'mr.peneliti@gmail.com';
      if can_reverse and old.destination_area = 'PICKER'
        and old.return_case_id is null
        and old.request_status in ('completed', 'cancelled') then
        return old;
      end if;
    end if;
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

create or replace function public.reverse_restock_pick(p_request_id uuid, p_actual_qty integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.restock_request%rowtype;
  v_source public.warehouse_storage%rowtype;
  v_queue public.warehouse_shelving_queue%rowtype;
  v_queue_qty integer := 0;
  v_actual_qty integer;
  v_source_label text;
  v_actor text := coalesce(nullif(auth.jwt()->>'email', ''), auth.uid()::text);
begin
  if auth.uid() is null or not (exists (
    select 1 from public.dir_user_profiles profile
    where profile.authenticated_id = auth.uid()
      and profile.role in ('admin', 'warehouse_leader')
  ) or lower(coalesce(auth.jwt()->>'email', '')) = 'mr.peneliti@gmail.com') then
    raise exception 'Only admin or warehouse leader can reverse pick history.' using errcode = '42501';
  end if;

  select * into v_request from public.restock_request
  where id = p_request_id for update;
  if not found or v_request.request_status <> 'completed'
    or v_request.destination_area <> 'PICKER' or v_request.return_case_id is not null then
    raise exception 'Only a completed picker request can be reversed.';
  end if;
  if coalesce(v_request.rejected_qty, 0) <> 0
    or coalesce(v_request.sales_upload_credited_qty, 0) <> 0
    or exists (select 1 from public.upload_arkline_pick_offsets where restock_request_id = p_request_id)
    or exists (select 1 from public.warehouse_temporary_sales_items where restock_request_id = p_request_id) then
    raise exception 'This pick already affects upload, reject, or temporary stock and cannot be reversed automatically.';
  end if;
  if v_request.storage_id is null or v_request.storage_id !~ '^[0-9]+$' then
    raise exception 'This pick has no recorded source location. Reconcile its stock manually.';
  end if;
  v_actual_qty := coalesce(v_request.fulfilled_qty, p_actual_qty);
  if coalesce(v_actual_qty, 0) <= 0 then
    raise exception 'Enter the actual picked quantity for this older request.';
  end if;

  select * into v_source from public.warehouse_storage
  where id = v_request.storage_id::bigint for update;
  if not found then
    raise exception 'The original source row no longer exists. Reconcile its stock manually.';
  end if;
  if nullif(btrim(v_request.source_sku_id), '') is not null
    and v_request.source_sku_id is distinct from coalesce(nullif(btrim(v_source.sku_id), ''), nullif(btrim(v_source.source_variant_code), '')) then
    raise exception 'The original source item has changed. Reconcile its stock manually.';
  end if;
  select pg_catalog.concat_ws(' / ',
    nullif(btrim(location_type), ''), nullif(btrim(location_id::text), ''),
    nullif(btrim(location_code), ''), nullif(btrim(sub_location), '')
  ) into v_source_label
  from public.dir_rack_locations where id = v_source.rack_location_id;
  if v_source_label is distinct from v_request.take_from then
    raise exception 'The original source location has changed. Reconcile its stock manually.';
  end if;

  for v_queue in
    select * from public.warehouse_shelving_queue
    where restock_request_id = p_request_id for update
  loop
    if v_queue.status <> 'WAITING_SHELVING' then
      raise exception 'Excess stock was already placed or changed. Reverse it manually first.';
    end if;
    v_queue_qty := v_queue_qty + v_queue.qty;
  end loop;
  if v_actual_qty > v_request.qty
    and v_queue_qty <> v_actual_qty - v_request.qty then
    raise exception 'Excess stock was placed directly into shelving. Reverse it manually first.';
  end if;
  if v_actual_qty <= v_request.qty and v_queue_qty <> 0 then
    raise exception 'The shelving queue does not match this pick. Review it before reversing.';
  end if;

  delete from public.warehouse_shelving_queue where restock_request_id = p_request_id;
  update public.warehouse_storage
  set qty = qty + v_actual_qty, updated_by = v_actor, updated_at = now()
  where id = v_source.id;

  insert into public.warehouse_storage_movements (
    warehouse_storage_id, movement_type, qty, from_location_label,
    to_location_label, item_name, size, sku_id, created_by, created_at
  ) values (
    v_source.id, 'RESTOCK_OUT', v_actual_qty, v_source_label,
    'Picker', v_request.item_name, v_request.size, v_request.source_sku_id,
    v_request.completed_by, coalesce(v_request.completed_at, v_request.created_at)
  ), (
    v_source.id, 'RESTOCK_REVERSE_IN', v_actual_qty, 'Picker',
    v_source_label, v_request.item_name, v_request.size, v_request.source_sku_id,
    v_actor, now()
  );

  perform pg_catalog.set_config('warehouse.restock_reverse_request_id', p_request_id::text, true);
  delete from public.restock_request where id = p_request_id;
end;
$$;

create or replace function public.delete_cancelled_restock_pick(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.restock_request%rowtype;
begin
  if auth.uid() is null or not (exists (
    select 1 from public.dir_user_profiles profile
    where profile.authenticated_id = auth.uid()
      and profile.role in ('admin', 'warehouse_leader')
  ) or lower(coalesce(auth.jwt()->>'email', '')) = 'mr.peneliti@gmail.com') then
    raise exception 'Only admin or warehouse leader can delete cancelled pick history.' using errcode = '42501';
  end if;

  select * into v_request from public.restock_request
  where id = p_request_id for update;
  if not found or v_request.request_status <> 'cancelled'
    or v_request.destination_area <> 'PICKER' or v_request.return_case_id is not null then
    raise exception 'Only an unrelated cancelled picker request can be deleted.';
  end if;
  if exists (select 1 from public.warehouse_shelving_queue where restock_request_id = p_request_id)
    or exists (select 1 from public.warehouse_temporary_sales_items where restock_request_id = p_request_id)
    or exists (select 1 from public.upload_arkline_pick_offsets where restock_request_id = p_request_id) then
    raise exception 'This request still has linked stock history and cannot be deleted.';
  end if;

  perform pg_catalog.set_config('warehouse.restock_reverse_request_id', p_request_id::text, true);
  delete from public.restock_request where id = p_request_id;
end;
$$;

revoke all on function public.reverse_restock_pick(uuid, integer) from public, anon;
revoke all on function public.delete_cancelled_restock_pick(uuid) from public, anon;
grant execute on function public.reverse_restock_pick(uuid, integer) to authenticated;
grant execute on function public.delete_cancelled_restock_pick(uuid) to authenticated;
