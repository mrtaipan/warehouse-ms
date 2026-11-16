begin;

create or replace function public.warehouse_loan_refresh_status(p_loan_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_issued integer; v_requested integer; v_resolved integer; v_closed integer; v_cancelled integer;
begin
  select
    coalesce(sum(qty) filter (where event_type = 'REQUEST'), 0),
    coalesce(sum(qty) filter (where event_type = 'ISSUE'), 0),
    coalesce(sum(qty) filter (where event_type in ('RECEIVE', 'CLOSE')), 0),
    coalesce(sum(qty) filter (where event_type = 'CLOSE'), 0),
    coalesce(sum(qty) filter (where event_type = 'CANCEL_REQUEST'), 0)
  into v_requested, v_issued, v_resolved, v_closed, v_cancelled
  from public.warehouse_loan_items where loan_id = p_loan_id;

  update public.warehouse_loans set status = case
    when v_requested > 0 and v_cancelled = v_requested and v_issued = 0 then 'CANCELLED'
    when v_issued + v_cancelled >= v_requested and v_resolved >= v_issued and v_closed > 0 then 'CLOSED'
    when v_issued > 0 and v_issued + v_cancelled >= v_requested and v_resolved >= v_issued then 'COMPLETED'
    when v_issued > 0 and v_issued + v_cancelled >= v_requested then 'IN_LOAN'
    else 'REQUESTED' end,
    updated_at = now()
  where id = p_loan_id;
end;
$$;
revoke all on function public.warehouse_loan_refresh_status(uuid) from public, anon, authenticated;

create or replace function public.receive_warehouse_loan_return(
  p_declaration_id uuid, p_qty integer, p_destination text, p_rack_location_id bigint default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_declaration public.warehouse_loan_items%rowtype;
  v_request public.warehouse_loan_items%rowtype;
  v_loan public.warehouse_loans%rowtype;
  v_location public.dir_rack_locations%rowtype;
  v_request_id uuid;
  v_issued integer;
  v_received integer;
  v_closed integer;
  v_declaration_received integer;
  v_id uuid;
  v_reqc_queue_id uuid;
  v_new_storage_id bigint;
  v_email text := coalesce(auth.jwt()->>'email', '');
  v_category_id bigint;
  v_brand_code text;
  v_pl_source_id bigint;
begin
  if (select auth.uid()) is null or not public.warehouse_loan_can_manage() then
    raise exception 'Not allowed to receive loans';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Qty must be positive'; end if;

  select * into v_declaration from public.warehouse_loan_items
  where id = p_declaration_id and event_type = 'DECLARE_RETURN' for update;
  v_request_id := coalesce(v_declaration.request_item_id, p_declaration_id);
  select * into v_request from public.warehouse_loan_items
  where id = v_request_id and event_type = 'REQUEST' for update;
  if not found then raise exception 'Loan item not found'; end if;
  select * into v_loan from public.warehouse_loans where id = v_request.loan_id for update;

  select coalesce(sum(qty) filter (where event_type = 'ISSUE'), 0),
    coalesce(sum(qty) filter (where event_type = 'RECEIVE'), 0),
    coalesce(sum(qty) filter (where event_type = 'CLOSE'), 0)
  into v_issued, v_received, v_closed
  from public.warehouse_loan_items where request_item_id = v_request.id;
  if p_qty > v_issued - v_received - v_closed then
    raise exception 'Receive qty exceeds the outstanding loan balance';
  end if;
  if v_declaration.id is not null then
    select coalesce(sum(qty), 0) into v_declaration_received
    from public.warehouse_loan_items
    where declaration_id = v_declaration.id and event_type = 'RECEIVE';
    if v_declaration_received + p_qty > v_declaration.qty then
      raise exception 'Qty exceeds declared return';
    end if;
  end if;
  if p_destination not in ('STORAGE','SHELVING_QUEUE','STORAGE_QUEUE','TEMP_SALES','RE_QC') then
    raise exception 'Choose a return destination';
  end if;
  if p_destination = 'STORAGE_QUEUE' and (
    not exists (select 1 from public.warehouse_loan_items where request_item_id = v_request.id
      and event_type = 'ISSUE' and source_type = 'PL_QUEUE')
    or exists (select 1 from public.warehouse_loan_items where request_item_id = v_request.id
      and event_type = 'ISSUE' and source_type <> 'PL_QUEUE')
  ) then raise exception 'Storage Queue return requires this item to be borrowed only from Storage Queue'; end if;

  select category_id, brand_code into v_category_id, v_brand_code
  from public.warehouse_loan_items where request_item_id = v_request.id and event_type = 'ISSUE'
    and category_id is not null order by created_at desc limit 1;
  if not exists (select 1 from public.warehouse_loan_items where request_item_id = v_request.id
      and event_type = 'ISSUE' and source_type = 'STORAGE') then
    select source_pl_packing_item_id into v_pl_source_id
    from public.warehouse_loan_items where request_item_id = v_request.id and event_type = 'ISSUE'
    order by created_at desc limit 1;
  end if;

  if p_destination = 'STORAGE' then
    select * into v_location from public.dir_rack_locations where id = p_rack_location_id;
    if not found or upper(coalesce(v_location.group_code, '')) <> v_loan.group_code
      or upper(coalesce(v_location.location_type, '')) not in ('PALLET','SHELVING') then
      raise exception 'Choose a pallet or shelving location in the same group';
    end if;
    insert into public.warehouse_storage(
      rack_location_id, source_pl_packing_item_id, sku_id, source_variant_code,
      item_name, size, category_id, brand_code, qty, notes, updated_by
    ) values (
      v_location.id, v_pl_source_id, v_request.sku_id, v_request.sku_id,
      v_request.item_name, v_request.size, v_category_id, v_brand_code, p_qty,
      'Returned from loan ' || v_loan.id::text, v_email
    ) returning id into v_new_storage_id;
    insert into public.warehouse_storage_movements(
      warehouse_storage_id, movement_type, qty, from_location_label,
      to_location_label, item_name, size, sku_id, created_by
    ) values (
      v_new_storage_id, 'LOAN_RETURN', p_qty, 'Peminjaman ' || v_loan.id::text,
      concat_ws(' / ', v_location.location_type, v_location.location_id,
        v_location.location_code, nullif(v_location.sub_location, '')),
      v_request.item_name, v_request.size, v_request.sku_id, v_email
    );
  elsif p_destination = 'TEMP_SALES' then
    insert into public.warehouse_temporary_sales_items(
      source_pl_packing_item_id, sku_id, source_variant_code, item_name, size,
      category_id, group_code, area_type, source_location_label, qty_in_area, status, created_by
    ) values (
      v_pl_source_id, v_request.sku_id, v_request.sku_id, v_request.item_name,
      v_request.size, v_category_id, v_loan.group_code, 'SALES',
      'Returned from loan ' || v_loan.id::text, p_qty, 'IN_TEMPORARY_AREA', v_email
    );
  elsif p_destination = 'SHELVING_QUEUE' then
    insert into public.warehouse_shelving_queue(
      sku_id, source_variant_code, item_name, size, group_code, qty,
      status, notes, created_by
    ) values (
      v_request.sku_id, v_request.sku_id, v_request.item_name, v_request.size,
      v_loan.group_code, p_qty, 'WAITING_SHELVING',
      'Returned from loan ' || v_loan.id::text, v_email
    );
  elsif p_destination = 'RE_QC' then
    insert into public.reqc_queue(
      sku_id, source_variant_code, item_name, size, category_id, brand_code,
      group_code, qty, status, notes, created_by
    ) values (
      v_request.sku_id, v_request.sku_id, v_request.item_name, v_request.size,
      v_category_id, v_brand_code, v_loan.group_code, p_qty, 'WAITING_QC',
      'Returned from loan ' || v_loan.id::text, v_email
    ) returning id into v_reqc_queue_id;
  end if;

  insert into public.warehouse_loan_items(
    loan_id, request_item_id, declaration_id, event_type, sku_id, item_name,
    size, category_id, brand_code, source_pl_packing_item_id, qty,
    destination_type, destination_rack_location_id, actor_id, actor_email
  ) values (
    v_loan.id, v_request.id, v_declaration.id, 'RECEIVE', v_request.sku_id,
    v_request.item_name, v_request.size, v_category_id, v_brand_code,
    v_pl_source_id, p_qty, p_destination, p_rack_location_id,
    (select auth.uid()), v_email
  ) returning id into v_id;
  if v_reqc_queue_id is not null then
    update public.reqc_queue set source_loan_receive_id = v_id where id = v_reqc_queue_id;
  end if;
  perform public.warehouse_loan_refresh_status(v_loan.id);
  return v_id;
end;
$$;

create or replace function public.receive_warehouse_loan_item(
  p_item_id uuid, p_qty integer, p_destination text, p_rack_location_id bigint default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or not public.warehouse_loan_can_manage() then
    raise exception 'Not allowed to receive loans';
  end if;
  return public.receive_warehouse_loan_return(
    p_item_id, p_qty, p_destination, p_rack_location_id
  );
end;
$$;
revoke all on function public.receive_warehouse_loan_item(uuid,integer,text,bigint) from public, anon;
grant execute on function public.receive_warehouse_loan_item(uuid,integer,text,bigint) to authenticated;


create or replace function public.close_warehouse_loan_item(
  p_item_id uuid, p_qty integer, p_disposition text, p_reason text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request public.warehouse_loan_items%rowtype;
  v_loan public.warehouse_loans%rowtype;
  v_issued integer;
  v_received integer;
  v_closed integer;
  v_id uuid;
begin
  if (select auth.uid()) is null or not public.warehouse_loan_can_manage() then
    raise exception 'Not allowed to close loans';
  end if;
  if p_qty is null or p_qty <= 0 or p_disposition not in ('LOST','DAMAGED','PURCHASED','OTHER')
    or btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Enter qty, outcome, and reason';
  end if;
  select * into v_request from public.warehouse_loan_items
    where id = p_item_id and event_type = 'REQUEST' for update;
  if not found then raise exception 'Loan item not found'; end if;
  select * into v_loan from public.warehouse_loans where id = v_request.loan_id for update;
  select coalesce(sum(qty) filter (where event_type = 'ISSUE'), 0),
    coalesce(sum(qty) filter (where event_type = 'RECEIVE'), 0),
    coalesce(sum(qty) filter (where event_type = 'CLOSE'), 0)
  into v_issued, v_received, v_closed
  from public.warehouse_loan_items where request_item_id = p_item_id;
  if p_qty > v_issued - v_received - v_closed then
    raise exception 'Close qty exceeds the outstanding loan balance';
  end if;
  insert into public.warehouse_loan_items(
    loan_id, request_item_id, event_type, sku_id, item_name, size, qty,
    disposition, notes, actor_id, actor_email
  ) values (
    v_loan.id, p_item_id, 'CLOSE', v_request.sku_id, v_request.item_name,
    v_request.size, p_qty, p_disposition, btrim(p_reason),
    (select auth.uid()), coalesce(auth.jwt()->>'email', '')
  ) returning id into v_id;
  perform public.warehouse_loan_refresh_status(v_loan.id);
  return v_id;
end;
$$;
revoke all on function public.close_warehouse_loan_item(uuid,integer,text,text) from public, anon;
grant execute on function public.close_warehouse_loan_item(uuid,integer,text,text) to authenticated;

do $$
declare v_loan_id uuid;
begin
  for v_loan_id in select id from public.warehouse_loans where status = 'RETURN_PENDING' loop
    perform public.warehouse_loan_refresh_status(v_loan_id);
  end loop;
end;
$$;

commit;
