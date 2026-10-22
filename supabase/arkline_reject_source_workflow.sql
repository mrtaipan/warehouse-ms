-- Run after arkline_rejection_storage_item_registration.sql and
-- upload_sales_import_arkline_workflow.sql. Re-run the updated upload workflow
-- after this file so settlement excludes rejected direct-pick units.
begin;

alter table public.restock_request
  add column if not exists rejected_qty integer not null default 0;

alter table public.restock_request
  drop constraint if exists restock_request_rejected_qty_check;
alter table public.restock_request
  add constraint restock_request_rejected_qty_check
  check (rejected_qty >= 0 and rejected_qty <= least(qty, coalesce(fulfilled_qty, qty)));

alter table public.restock_request
  drop constraint if exists restock_request_sales_upload_credit_check;
alter table public.restock_request
  add constraint restock_request_sales_upload_credit_check
  check (
    (fulfilled_qty is null or fulfilled_qty > 0)
    and sales_upload_credited_qty >= 0
    and sales_upload_credited_qty <= least(qty, coalesce(fulfilled_qty, qty)) - rejected_qty
  );

alter table public.arkline_qc_rejection_storage_batches
  add column if not exists inventory_source text,
  add column if not exists source_warehouse_storage_id bigint,
  add column if not exists source_restock_request_id uuid,
  add column if not exists source_location_label text,
  add column if not exists stock_applied_at timestamptz;

alter table public.arkline_qc_rejection_storage_batches
  drop constraint if exists arkline_rejection_inventory_source_check;
alter table public.arkline_qc_rejection_storage_batches
  add constraint arkline_rejection_inventory_source_check
  check (
    (inventory_source is null and source_warehouse_storage_id is null and source_restock_request_id is null)
    or (inventory_source = 'SHELVING' and source_warehouse_storage_id is not null and source_restock_request_id is null)
    or (inventory_source = 'PALLET_RESTOCK' and source_warehouse_storage_id is null and source_restock_request_id is not null)
  );

create index if not exists arkline_rejection_source_restock_idx
  on public.arkline_qc_rejection_storage_batches (source_restock_request_id)
  where source_restock_request_id is not null;

alter table public.warehouse_storage_movements
  drop constraint if exists warehouse_storage_movements_type_check;
alter table public.warehouse_storage_movements
  add constraint warehouse_storage_movements_type_check check (movement_type in (
    'STORE_QUEUE', 'MOVE', 'TAKE_OUT', 'TEMPORARY_IN', 'TEMPORARY_RETURN',
    'TEMPORARY_ADJUSTMENT_IN', 'TEMPORARY_ADJUSTMENT_OUT', 'PUTAWAY_IN',
    'CUSTOMER_RETURN_IN', 'CUSTOMER_REPLACEMENT_OUT', 'QC_RECHECK_OUT', 'REJECT_OUT'
  ));

create or replace function public.register_arkline_rejection_storage_item(
  p_storage_number text,
  p_sku_induk text,
  p_model_name text,
  p_size text,
  p_reject_reason_id uuid,
  p_qty integer,
  p_storage_date date,
  p_notes text,
  p_created_by text,
  p_inventory_source text,
  p_source_warehouse_storage_id bigint,
  p_source_restock_request_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_storage public.warehouse_storage%rowtype;
  v_location public.dir_rack_locations%rowtype;
  v_request public.restock_request%rowtype;
  v_source_label text;
  v_sku text := substring(pg_catalog.regexp_replace(upper(coalesce(p_sku_induk, '')), '[^A-Z0-9]', '', 'g') from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}');
  v_size text := pg_catalog.regexp_replace(upper(coalesce(p_size, '')), '[^A-Z0-9]', '', 'g');
  v_direct_capacity integer;
  v_actor text := coalesce(nullif((select auth.jwt()) ->> 'email', ''), nullif(trim(p_created_by), ''), (select auth.uid())::text);
begin
  if (select auth.uid()) is null and current_user <> 'postgres' then
    raise exception 'Authentication is required';
  end if;
  if current_user <> 'postgres' and not exists (
    select 1
    from public.dir_user_profiles profile
    left join public.dir_user_roles role_map on role_map.role = profile.role
    where profile.authenticated_id = (select auth.uid())
      and (
        profile.role in ('admin', 'qc_coordinator', 'storage_coordinator')
        or role_map.permission_code in ('storage.location.add', 'storage.location.edit')
      )
  ) then
    raise exception 'Not allowed to register Arkline reject storage items';
  end if;
  if v_sku is null or v_size = '' or p_qty is null or p_qty < 1 then
    raise exception 'Arkline SKU, size, and positive reject qty are required';
  end if;
  if p_inventory_source not in ('SHELVING', 'PALLET_RESTOCK') then
    raise exception 'Choose Shelving or Restock Pallet as the reject source';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(v_sku), pg_catalog.hashtext(v_size));

  if p_inventory_source = 'SHELVING' then
    if p_source_warehouse_storage_id is null or p_source_restock_request_id is not null then
      raise exception 'Choose one Arkline shelving stock row';
    end if;
    select * into v_storage
    from public.warehouse_storage
    where id = p_source_warehouse_storage_id
    for update;
    if v_storage.id is null then
      raise exception 'Shelving stock is no longer available';
    end if;
    select * into v_location
    from public.dir_rack_locations
    where id = v_storage.rack_location_id;
    if upper(coalesce(v_location.group_code, '')) <> 'ARKLINE'
       or upper(coalesce(v_location.location_type, '')) <> 'SHELVING'
       or substring(pg_catalog.regexp_replace(upper(coalesce(nullif(trim(v_storage.sku_id), ''), v_storage.source_variant_code, '')), '[^A-Z0-9]', '', 'g') from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}') is distinct from v_sku
       or pg_catalog.regexp_replace(upper(coalesce(v_storage.size, '')), '[^A-Z0-9]', '', 'g') <> v_size then
      raise exception 'Selected shelving row does not match this Arkline SKU and size';
    end if;
    if v_storage.qty < p_qty then
      raise exception 'Shelving stock is less than the reject qty';
    end if;
    v_source_label := pg_catalog.concat_ws(' / ', v_location.location_type, v_location.location_id, v_location.location_code, v_location.sub_location);
  else
    if p_source_restock_request_id is null or p_source_warehouse_storage_id is not null then
      raise exception 'Choose one completed pallet restock request';
    end if;
    select * into v_request
    from public.restock_request
    where id = p_source_restock_request_id
    for update;
    if v_request.id is null or v_request.source_type <> 'ARKLINE' or v_request.request_status <> 'completed'
       or upper(coalesce(v_request.take_from, '')) not like 'PALLET%'
       or substring(pg_catalog.regexp_replace(upper(coalesce(nullif(trim(v_request.source_sku_id), ''), v_request.search_term)), '[^A-Z0-9]', '', 'g') from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}') is distinct from v_sku
       or pg_catalog.regexp_replace(upper(coalesce(v_request.size, '')), '[^A-Z0-9]', '', 'g') <> v_size then
      raise exception 'Selected pallet restock does not match this Arkline SKU and size';
    end if;
    if (v_request.completed_at at time zone 'Asia/Jakarta')::date
       is distinct from coalesce(p_storage_date, (now() at time zone 'Asia/Jakarta')::date) then
      raise exception 'Pallet restock must be completed on the selected Storage Date (WIB)';
    end if;
    v_direct_capacity := least(v_request.qty, coalesce(v_request.fulfilled_qty, v_request.qty));
    if p_qty > v_direct_capacity - v_request.rejected_qty - v_request.sales_upload_credited_qty then
      raise exception 'Reject qty exceeds uncredited direct restock qty. If this restock was already included in a settled upload, reverse that upload first.';
    end if;
    v_source_label := v_request.take_from;
  end if;

  v_batch_id := public.create_arkline_qc_rejection_storage_batch(
    p_storage_number, null, null, v_sku, p_model_name, null, null, 1,
    coalesce(p_storage_date, current_date), p_notes, v_actor,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'reject_detail_id', null, 'reject_reason_id', p_reject_reason_id,
      'grade', 'C', 'size', upper(trim(p_size)), 'qty', p_qty
    ))
  );

  update public.arkline_qc_rejection_storage_batches
  set inventory_source = p_inventory_source,
      source_warehouse_storage_id = p_source_warehouse_storage_id,
      source_restock_request_id = p_source_restock_request_id,
      source_location_label = v_source_label,
      stock_applied_at = now()
  where id = v_batch_id;

  if p_inventory_source = 'SHELVING' then
    update public.warehouse_storage
    set qty = qty - p_qty, updated_by = v_actor, updated_at = now()
    where id = v_storage.id;

    insert into public.warehouse_storage_movements (
      warehouse_storage_id, movement_type, qty, from_location_label,
      to_location_label, item_name, size, sku_id, created_by
    ) values (
      v_storage.id, 'REJECT_OUT', p_qty, v_source_label,
      'Arkline Reject Storage / ' || trim(p_storage_number),
      v_storage.item_name, v_storage.size, v_sku, v_actor
    );
  else
    perform pg_catalog.set_config('warehouse.arkline_reject_batch_id', v_batch_id::text, true);
    update public.restock_request
    set rejected_qty = rejected_qty + p_qty
    where id = v_request.id;
  end if;

  return v_batch_id;
end;
$$;

revoke execute on function public.register_arkline_rejection_storage_item(text,text,text,text,uuid,integer,date,text,text,text,bigint,uuid) from public, anon;
grant execute on function public.register_arkline_rejection_storage_item(text,text,text,text,uuid,integer,date,text,text,text,bigint,uuid) to authenticated;

commit;
