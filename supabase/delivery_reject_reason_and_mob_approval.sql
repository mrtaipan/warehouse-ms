-- Replace free-form Arkline Delivery reasons with an active reason from the directory.
drop function if exists public.update_arkline_delivery_reject_reason(bigint, text);

create or replace function public.update_arkline_delivery_reject_reason(
  p_return_item_id bigint,
  p_reason_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.delivery_return_items%rowtype;
  v_reason text;
  v_sku text;
begin
  if (select auth.uid()) is null or not public.reqc_has_permission('qc.retur_report.edit') then
    raise exception 'You cannot edit Delivery reject reasons';
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

  select reason_name into v_reason
  from public.arkline_qc_reject_reasons
  where id = p_reason_id and is_active = true;
  if not found then
    raise exception 'Choose an active Arkline reject reason';
  end if;

  update public.delivery_return_items
  set reason = v_reason, updated_at = now(), updated_by = (select auth.uid())::text
  where id = v_item.id;
end;
$$;

-- The storage row keeps the canonical reason ID as well as its display snapshot.
create or replace function public.validate_arkline_delivery_storage_reason()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.delivery_return_items%rowtype;
  v_reason_id uuid;
  v_reason_name text;
begin
  if new.delivery_return_item_id is null then
    return new;
  end if;

  select * into v_item from public.delivery_return_items
  where id = new.delivery_return_item_id for update;
  if not found or v_item.outcome <> 'REJECT' or v_item.route_status <> 'PENDING_ARRANGEMENT' then
    raise exception 'This Delivery reject is no longer available';
  end if;

  select id, reason_name into v_reason_id, v_reason_name
  from public.arkline_qc_reject_reasons
  where is_active = true
    and lower(btrim(reason_name)) = lower(btrim(coalesce(v_item.reason, '')))
  order by id limit 1;
  if not found then
    raise exception 'Select an Arkline reject reason before storing this Delivery item';
  end if;

  new.reject_reason_id := v_reason_id;
  new.reason_snapshot := v_reason_name;
  return new;
end;
$$;

drop trigger if exists arkline_delivery_storage_reason on public.arkline_qc_rejection_storage_lines;
create trigger arkline_delivery_storage_reason
  before insert on public.arkline_qc_rejection_storage_lines
  for each row execute function public.validate_arkline_delivery_storage_reason();

create or replace function public.store_mob_oi_delivery_rejects(
  p_return_item_ids bigint[]
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
  v_count integer := 0;
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
    if not found or v_item.outcome <> 'REJECT' or v_item.route_status <> 'PENDING_ARRANGEMENT'
      or v_item.group_code not in ('MOB', 'OI') then
      raise exception 'MOB/OI Delivery reject % is no longer available', v_id;
    end if;
    v_sku := pg_catalog.regexp_replace(upper(coalesce(v_item.sku, '')), '[^A-Z0-9]', '', 'g');
    if v_sku = '' then
      raise exception 'Product % needs a SKU before it can return to shelving', v_id;
    end if;
    if v_sku ~ '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}'
      or exists (
        select 1 from public.arkline_dir_products product
        where pg_catalog.regexp_replace(upper(coalesce(product.sku_induk, '')), '[^A-Z0-9]', '', 'g') = v_sku
      ) then
      raise exception 'Arkline products must be reviewed in the Delivery Arkline tab';
    end if;

    select kode_kejadian into v_case_code
    from public.delivery_error_retur_cases
    where id = v_item.case_id and upper(btrim(group_order)) = v_item.group_code;
    if not found then
      raise exception 'The Delivery return case does not match product %', v_id;
    end if;

    insert into public.warehouse_shelving_queue (
      delivery_return_item_id, source_location_label, sku_id, source_variant_code,
      item_name, size, group_code, qty, notes, created_by
    ) values (
      v_item.id, 'DELIVERY REJECT APPROVED / ' || v_case_code,
      v_item.sku, v_item.sku, v_item.product_name, v_item.size,
      v_item.group_code, v_item.qty, 'Return case ' || v_case_code, v_actor
    );

    update public.delivery_return_items
    set route_status = 'WAITING_SHELVING', handled_at = now(), handled_by = v_actor,
        updated_at = now(), updated_by = v_actor
    where id = v_item.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.update_arkline_delivery_reject_reason(bigint, uuid) from public, anon;
revoke all on function public.validate_arkline_delivery_storage_reason() from public, anon;
revoke all on function public.store_mob_oi_delivery_rejects(bigint[]) from public, anon;
grant execute on function public.update_arkline_delivery_reject_reason(bigint, uuid) to authenticated;
grant execute on function public.store_mob_oi_delivery_rejects(bigint[]) to authenticated;

notify pgrst, 'reload schema';
