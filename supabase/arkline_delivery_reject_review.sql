-- Keep the Delivery decision as REJECT for audit, even when QC accepts it into stock.
alter table public.delivery_return_items
  drop constraint if exists delivery_return_items_route_status_check;

alter table public.delivery_return_items
  add constraint delivery_return_items_route_status_check check (
    (outcome = 'STORED' and route_status in ('PENDING', 'WAITING_SHELVING', 'STORED')) or
    (outcome = 'REJECT' and route_status in (
      'PENDING', 'PENDING_ARRANGEMENT', 'RETURN_BATCHED', 'REJECTION_STORED',
      'KOLI_ASSIGNED', 'WAITING_SHELVING', 'STORED'
    )) or
    (outcome = 'LOST' and route_status in ('PENDING', 'RECORDED'))
  );

alter table public.arkline_qc_rejection_storage_batches
  drop constraint if exists arkline_qc_rejection_storage_batches_source_type_check;

alter table public.arkline_qc_rejection_storage_batches
  add constraint arkline_qc_rejection_storage_batches_source_type_check
    check (source_type in ('QC_REJECT', 'PACKING_REJECT', 'DELIVERY_REJECT'));

alter table public.arkline_qc_rejection_storage_lines
  add column if not exists delivery_return_item_id bigint
    references public.delivery_return_items(id) on delete restrict,
  add column if not exists reason_snapshot text;

alter table public.arkline_qc_rejection_storage_lines
  alter column grade drop not null;

alter table public.arkline_qc_rejection_storage_lines
  add constraint arkline_delivery_reject_line_source_check
    check (delivery_return_item_id is null or (reject_detail_id is null and grade is null));

create unique index if not exists arkline_delivery_reject_line_item_uidx
  on public.arkline_qc_rejection_storage_lines (delivery_return_item_id)
  where delivery_return_item_id is not null;

create or replace function public.sync_delivery_return_shelving_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.delivery_return_item_id is null or new.status is not distinct from old.status then
    return new;
  end if;

  update public.delivery_return_items
  set route_status = case
        when new.status = 'STORED' then 'STORED'
        when new.status = 'WAITING_SHELVING' then 'WAITING_SHELVING'
        else 'PENDING'
      end,
      handled_at = case when new.status = 'STORED' then coalesce(new.stored_at, now()) else null end,
      handled_by = case when new.status = 'STORED' then new.stored_by else null end,
      updated_at = now(), updated_by = coalesce(new.stored_by, new.created_by)
  where id = new.delivery_return_item_id and outcome in ('STORED', 'REJECT');

  return new;
end;
$$;

create or replace function public.update_arkline_delivery_reject_reason(
  p_return_item_id bigint,
  p_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.delivery_return_items%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_sku text;
begin
  if (select auth.uid()) is null or not public.reqc_has_permission('qc.retur_report.edit') then
    raise exception 'You cannot edit Delivery reject reasons';
  end if;
  if v_reason is null or length(v_reason) > 500 then
    raise exception 'Reject reason must contain 1 to 500 characters';
  end if;

  select * into v_item from public.delivery_return_items
  where id = p_return_item_id for update;
  if not found or v_item.outcome <> 'REJECT' or v_item.route_status <> 'PENDING_ARRANGEMENT' then
    raise exception 'This Delivery reject is no longer available';
  end if;
  v_sku := pg_catalog.regexp_replace(upper(coalesce(v_item.sku, '')), '[^A-Z0-9]', '', 'g');
  if v_item.group_code <> 'ARKLINE' and v_sku !~ '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}'
    and not exists (
      select 1 from public.arkline_dir_products product
      where v_sku <> '' and pg_catalog.regexp_replace(upper(coalesce(product.sku_induk, '')), '[^A-Z0-9]', '', 'g') = v_sku
    ) then
    raise exception 'This product is not in the Arkline Delivery route';
  end if;

  update public.delivery_return_items
  set reason = v_reason, updated_at = now(), updated_by = (select auth.uid())::text
  where id = v_item.id;
end;
$$;

create or replace function public.store_arkline_delivery_rejects(
  p_return_item_ids bigint[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.delivery_return_items%rowtype;
  v_id bigint;
  v_case_code text;
  v_sku text;
  v_sku_key text;
  v_location_count integer;
  v_stock_id bigint;
  v_location_label text;
  v_actor text;
  v_stored integer := 0;
  v_queued integer := 0;
begin
  if (select auth.uid()) is null or not public.reqc_has_permission('qc.retur_report.add') then
    raise exception 'You cannot store Delivery rejects';
  end if;
  if coalesce(array_length(p_return_item_ids, 1), 0) = 0 then
    raise exception 'Select at least one Delivery reject';
  end if;
  select coalesce(nullif(btrim(email), ''), (select auth.uid())::text)
  into v_actor from public.dir_user_profiles
  where authenticated_id = (select auth.uid()) limit 1;
  v_actor := coalesce(v_actor, (select auth.uid())::text);

  for v_id in select distinct unnest(p_return_item_ids) order by 1 loop
    select * into v_item from public.delivery_return_items
    where id = v_id for update;
    if not found or v_item.outcome <> 'REJECT' or v_item.route_status <> 'PENDING_ARRANGEMENT' then
      raise exception 'Delivery reject % is no longer available', v_id;
    end if;
    v_sku := pg_catalog.regexp_replace(upper(coalesce(v_item.sku, '')), '[^A-Z0-9]', '', 'g');
    if v_item.group_code <> 'ARKLINE' and v_sku !~ '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}'
      and not exists (
        select 1 from public.arkline_dir_products product
        where v_sku <> '' and pg_catalog.regexp_replace(upper(coalesce(product.sku_induk, '')), '[^A-Z0-9]', '', 'g') = v_sku
      ) then
      raise exception 'Product % is not in the Arkline Delivery route', v_id;
    end if;
    if v_sku = '' then
      raise exception 'Arkline product % needs a SKU before it can be stored', v_id;
    end if;
    v_sku_key := substring(v_sku from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}');
    select kode_kejadian into v_case_code
    from public.delivery_error_retur_cases where id = v_item.case_id;
    if not found then
      raise exception 'Delivery case for product % was not found', v_id;
    end if;

    select count(distinct stock.rack_location_id) into v_location_count
    from public.warehouse_storage stock
    join public.dir_rack_locations location on location.id = stock.rack_location_id
    where upper(location.group_code) = 'ARKLINE'
      and upper(location.location_type) = 'SHELVING'
      and substring(pg_catalog.regexp_replace(upper(coalesce(stock.sku_id, stock.source_variant_code, '')), '[^A-Z0-9]', '', 'g') from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}') = v_sku_key
      and public.warehouse_sizes_match(stock.size, v_item.size);

    if v_location_count = 1 then
      select stock.id,
        pg_catalog.concat_ws(' / ', location.location_type, location.location_id,
          location.location_code, nullif(location.sub_location, ''))
      into v_stock_id, v_location_label
      from public.warehouse_storage stock
      join public.dir_rack_locations location on location.id = stock.rack_location_id
      where upper(location.group_code) = 'ARKLINE'
        and upper(location.location_type) = 'SHELVING'
        and substring(pg_catalog.regexp_replace(upper(coalesce(stock.sku_id, stock.source_variant_code, '')), '[^A-Z0-9]', '', 'g') from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}') = v_sku_key
        and public.warehouse_sizes_match(stock.size, v_item.size)
      order by stock.id limit 1 for update of stock;
      if v_stock_id is null then
        raise exception 'Arkline shelving changed while processing Delivery reject %', v_id;
      end if;

      update public.warehouse_storage
      set qty = qty + v_item.qty, updated_by = v_actor, updated_at = now()
      where id = v_stock_id;

      insert into public.warehouse_storage_movements (
        warehouse_storage_id, delivery_return_item_id, movement_type, qty,
        from_location_label, to_location_label, item_name, size, sku_id, created_by
      ) values (
        v_stock_id, v_item.id, 'CUSTOMER_RETURN_IN', v_item.qty,
        'DELIVERY REJECT APPROVED / ' || v_case_code,
        v_location_label,
        v_item.product_name, v_item.size, v_item.sku, v_actor
      );
      update public.delivery_return_items
      set route_status = 'STORED', handled_at = now(), handled_by = v_actor,
          updated_at = now(), updated_by = v_actor
      where id = v_item.id;
      v_stored := v_stored + 1;
    else
      insert into public.warehouse_shelving_queue (
        delivery_return_item_id, source_location_label, sku_id, source_variant_code,
        item_name, size, group_code, qty, notes, created_by
      ) values (
        v_item.id, 'DELIVERY REJECT APPROVED / ' || v_case_code,
        v_item.sku, v_item.sku, v_item.product_name, v_item.size,
        'ARKLINE', v_item.qty, 'Return case ' || v_case_code, v_actor
      );
      update public.delivery_return_items
      set route_status = 'WAITING_SHELVING', handled_at = now(), handled_by = v_actor,
          updated_at = now(), updated_by = v_actor
      where id = v_item.id;
      v_queued := v_queued + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object('stored', v_stored, 'waiting_shelving', v_queued);
end;
$$;

create or replace function public.allocate_arkline_delivery_rejects_to_storage(
  p_return_item_ids bigint[],
  p_storage_number text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.delivery_return_items%rowtype;
  v_id bigint;
  v_sku text;
  v_case_code text;
  v_actor text;
  v_batch_id uuid;
  v_count integer := 0;
  v_storage_number text := btrim(coalesce(p_storage_number, ''));
begin
  if (select auth.uid()) is null or not public.reqc_has_permission('qc.retur_report.add') then
    raise exception 'You cannot allocate Arkline Delivery rejects';
  end if;
  if coalesce(array_length(p_return_item_ids, 1), 0) = 0 then
    raise exception 'Select at least one Delivery reject';
  end if;
  if v_storage_number = '' then
    raise exception 'Choose an existing Arkline reject storage number';
  end if;
  perform 1 from public.arkline_qc_rejection_storage_batches
  where storage_number = v_storage_number and status = 'STORED'
  order by id limit 1 for update;
  if not found then
    raise exception 'Arkline reject storage number was not found';
  end if;
  select coalesce(nullif(btrim(email), ''), (select auth.uid())::text)
  into v_actor from public.dir_user_profiles
  where authenticated_id = (select auth.uid()) limit 1;
  v_actor := coalesce(v_actor, (select auth.uid())::text);

  for v_id in select distinct unnest(p_return_item_ids) order by 1 loop
    select * into v_item from public.delivery_return_items
    where id = v_id for update;
    if not found or v_item.outcome <> 'REJECT' or v_item.route_status <> 'PENDING_ARRANGEMENT' then
      raise exception 'Delivery reject % is no longer available', v_id;
    end if;
    v_sku := pg_catalog.regexp_replace(upper(coalesce(v_item.sku, '')), '[^A-Z0-9]', '', 'g');
    if v_item.group_code <> 'ARKLINE' and v_sku !~ '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}'
      and not exists (
        select 1 from public.arkline_dir_products product
        where v_sku <> '' and pg_catalog.regexp_replace(upper(coalesce(product.sku_induk, '')), '[^A-Z0-9]', '', 'g') = v_sku
      ) then
      raise exception 'Product % is not in the Arkline Delivery route', v_id;
    end if;
    if v_sku = '' or nullif(btrim(coalesce(v_item.reason, '')), '') is null then
      raise exception 'Arkline product % needs a SKU and reject reason', v_id;
    end if;
    select kode_kejadian into v_case_code
    from public.delivery_error_retur_cases where id = v_item.case_id;
    if not found then
      raise exception 'Delivery case for product % was not found', v_id;
    end if;

    insert into public.arkline_qc_rejection_storage_batches (
      storage_number, sku_induk, model_name_snapshot, round_number,
      storage_date, stored_qty, source_type, notes, created_by
    ) values (
      v_storage_number, v_item.sku, v_item.product_name, 1,
      (now() at time zone 'Asia/Jakarta')::date, v_item.qty,
      'DELIVERY_REJECT', 'Delivery ' || v_case_code, v_actor
    ) returning id into v_batch_id;

    insert into public.arkline_qc_rejection_storage_lines (
      storage_batch_id, delivery_return_item_id, reason_snapshot, size, qty
    ) values (
      v_batch_id, v_item.id, v_item.reason,
      upper(coalesce(nullif(btrim(v_item.size), ''), '-')), v_item.qty
    );

    update public.delivery_return_items
    set route_status = 'REJECTION_STORED', handled_at = now(), handled_by = v_actor,
        updated_at = now(), updated_by = v_actor
    where id = v_item.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.update_arkline_delivery_reject_reason(bigint, text) from public, anon;
revoke all on function public.store_arkline_delivery_rejects(bigint[]) from public, anon;
revoke all on function public.allocate_arkline_delivery_rejects_to_storage(bigint[], text) from public, anon;
grant execute on function public.update_arkline_delivery_reject_reason(bigint, text) to authenticated;
grant execute on function public.store_arkline_delivery_rejects(bigint[]) to authenticated;
grant execute on function public.allocate_arkline_delivery_rejects_to_storage(bigint[], text) to authenticated;

notify pgrst, 'reload schema';
