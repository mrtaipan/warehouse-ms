-- Run warehouse_stock_size_matching.sql first.
-- Complete customer returns atomically after every product has been inspected.
alter table public.warehouse_shelving_queue
  add column if not exists delivery_return_item_id bigint null
    references public.delivery_return_items(id) on delete restrict;

create unique index if not exists warehouse_shelving_queue_return_item_uidx
  on public.warehouse_shelving_queue (delivery_return_item_id)
  where delivery_return_item_id is not null;

alter table public.warehouse_storage_movements
  add column if not exists delivery_return_item_id bigint null
    references public.delivery_return_items(id) on delete restrict;

create unique index if not exists warehouse_storage_movements_return_item_uidx
  on public.warehouse_storage_movements (delivery_return_item_id)
  where delivery_return_item_id is not null and movement_type = 'CUSTOMER_RETURN_IN';

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
  where id = new.delivery_return_item_id and outcome = 'STORED';

  return new;
end;
$$;

drop trigger if exists warehouse_shelving_queue_sync_delivery_return on public.warehouse_shelving_queue;
create trigger warehouse_shelving_queue_sync_delivery_return
  after update of status on public.warehouse_shelving_queue
  for each row execute function public.sync_delivery_return_shelving_status();

alter table public.warehouse_storage_movements
  drop constraint if exists warehouse_storage_movements_type_check;

alter table public.warehouse_storage_movements
  add constraint warehouse_storage_movements_type_check check (movement_type in (
    'STORE_QUEUE', 'MOVE', 'TAKE_OUT', 'TEMPORARY_IN', 'TEMPORARY_RETURN',
    'TEMPORARY_ADJUSTMENT_IN', 'TEMPORARY_ADJUSTMENT_OUT', 'PUTAWAY_IN',
    'CUSTOMER_RETURN_IN', 'CUSTOMER_REPLACEMENT_OUT'
  ));

create or replace function public.delivery_return_product_lines(p_products text)
returns table (line_no integer, sku text, product_name text, size text, qty integer)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_line text;
  v_field text;
  v_key text;
  v_value text;
begin
  line_no := 0;
  for v_line in
    select btrim(value) from unnest(string_to_array(replace(coalesce(p_products, ''), chr(13), ''), chr(10))) value
    where btrim(value) <> ''
  loop
    line_no := line_no + 1;
    sku := null; product_name := null; size := '-'; qty := null;
    foreach v_field in array string_to_array(v_line, '||') loop
      v_key := upper(btrim(split_part(v_field, ':', 1)));
      v_value := nullif(btrim(substr(v_field, strpos(v_field, ':') + 1)), '');
      case v_key
        when 'SKU' then sku := upper(v_value);
        when 'PRODUCT' then product_name := v_value;
        when 'SIZE' then size := coalesce(upper(v_value), '-');
        when 'QTY' then
          if v_value is null or v_value !~ '^[1-9][0-9]*$' then
            raise exception 'Product line % needs a positive whole quantity', line_no;
          end if;
          qty := v_value::integer;
        else raise exception 'Product line % must use SKU / PRODUCT / SIZE / QTY format', line_no;
      end case;
    end loop;
    if product_name is null or qty is null then
      raise exception 'Product line % needs PRODUCT and QTY', line_no;
    end if;
    return next;
  end loop;
end;
$$;

create or replace function public.delivery_stock_product_matches(
  p_stock_sku text, p_stock_variant text, p_stock_name text, p_sku text, p_name text
)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case when nullif(btrim(p_sku), '') is not null then exists (
    select 1 from regexp_split_to_table(concat_ws(' ', p_stock_sku, p_stock_variant, p_stock_name), '[[:space:]|,;/]+') token
    where regexp_replace(upper(token), '[^A-Z0-9]', '', 'g') = regexp_replace(upper(p_sku), '[^A-Z0-9]', '', 'g')
  ) else
    nullif(regexp_replace(upper(p_stock_name), '[^A-Z0-9]', '', 'g'), '') =
      nullif(regexp_replace(upper(p_name), '[^A-Z0-9]', '', 'g'), '')
    or (
      split_part(btrim(coalesce(p_name, '')), ' ', 1) ~ '^[A-Za-z0-9-]*[0-9][A-Za-z0-9-]*$'
      and length(regexp_replace(split_part(btrim(p_name), ' ', 1), '[^A-Za-z0-9]', '', 'g')) >= 6
      and regexp_replace(upper(coalesce(p_stock_sku, '')), '[^A-Z0-9]', '', 'g') =
        regexp_replace(upper(split_part(btrim(p_name), ' ', 1)), '[^A-Z0-9]', '', 'g')
    )
  end;
$$;

revoke all on function public.delivery_return_product_lines(text) from public, anon;
revoke all on function public.delivery_stock_product_matches(text, text, text, text, text) from public, anon;
grant execute on function public.delivery_return_product_lines(text) to authenticated, service_role;
grant execute on function public.delivery_stock_product_matches(text, text, text, text, text) to authenticated, service_role;

create or replace function public.complete_delivery_return_cases(p_cases jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_lines jsonb;
  v_line jsonb;
  v_case public.delivery_error_retur_cases%rowtype;
  v_actor text;
  v_role text;
  v_group text;
  v_source_count integer;
  v_source_line text;
  v_declared_qty integer;
  v_line_no integer;
  v_expected_qty integer;
  v_stored_qty integer;
  v_reject_qty integer;
  v_lost_qty integer;
  v_item_id bigint;
  v_sku text;
  v_sku_key text;
  v_product_name text;
  v_size text;
  v_size_key text;
  v_reject_reason text;
  v_lost_reason text;
  v_location_count integer;
  v_destination record;
  v_replacement record;
  v_stock record;
  v_area_type text;
  v_remaining numeric;
  v_take numeric;
  v_external_replacement_notes text;
  v_completed integer := 0;
begin
  if (select auth.uid()) is null then
    raise exception 'A signed-in user is required to complete a return';
  end if;

  if jsonb_typeof(p_cases) is distinct from 'array'
     or jsonb_array_length(p_cases) not between 1 and 50 then
    raise exception 'Select between 1 and 50 receiving cases';
  end if;

  select nullif(btrim(display_name), ''), lower(btrim(role))
  into v_actor, v_role
  from public.dir_user_profiles
  where authenticated_id = (select auth.uid())
  limit 1;

  v_actor := coalesce(v_actor, nullif(btrim((select auth.jwt() ->> 'email')), ''), (select auth.uid())::text);

  for v_payload in select value from jsonb_array_elements(p_cases) loop
    v_external_replacement_notes := '';
    select * into v_case
    from public.delivery_error_retur_cases
    where id = (v_payload ->> 'case_id')::bigint
    for update;

    if not found then
      raise exception 'Return case was not found';
    end if;
    if v_case.status_barang <> 'Sending' then
      raise exception 'Case % is no longer Sending', v_case.kode_kejadian;
    end if;
    if v_case.stock_applied_at is not null then
      raise exception 'Stock for case % has already been processed', v_case.kode_kejadian;
    end if;
    if exists (select 1 from public.delivery_return_items where case_id = v_case.id) then
      raise exception 'Case % already has return decisions', v_case.kode_kejadian;
    end if;

    v_group := upper(btrim(coalesce(v_case.group_order, '')));
    if v_group not in ('ARKLINE', 'MOB', 'OI') then
      raise exception 'Case % has an unsupported group', v_case.kode_kejadian;
    end if;
    if (v_role = 'arkline_cs' and v_group <> 'ARKLINE')
       or (v_role = 'mob_cs' and v_group <> 'MOB')
       or (v_role = 'oi_cs' and v_group <> 'OI') then
      raise exception 'Your role cannot complete case %', v_case.kode_kejadian;
    end if;

    v_lines := v_payload -> 'lines';
    if jsonb_typeof(v_lines) is distinct from 'array' then
      raise exception 'Case % needs a product inspection list', v_case.kode_kejadian;
    end if;

    select count(*) into v_source_count
    from unnest(pg_catalog.string_to_array(pg_catalog.replace(coalesce(v_case.produk_diretur, ''), chr(13), ''), chr(10))) as source_line(value)
    where btrim(value) <> '';

    if jsonb_array_length(v_lines) <> v_source_count then
      raise exception 'The returned product list changed for case %. Reopen inspection.', v_case.kode_kejadian;
    end if;

    for v_line, v_line_no in
      select value, ordinal::integer
      from jsonb_array_elements(v_lines) with ordinality as inspection(value, ordinal)
    loop
      v_expected_qty := (v_line ->> 'expected_qty')::integer;
      v_stored_qty := coalesce((v_line ->> 'stored_qty')::integer, 0);
      v_reject_qty := coalesce((v_line ->> 'reject_qty')::integer, 0);
      v_lost_qty := coalesce((v_line ->> 'lost_qty')::integer, 0);
      v_sku := nullif(upper(btrim(v_line ->> 'sku')), '');
      v_product_name := nullif(btrim(v_line ->> 'product_name'), '');
      v_size := nullif(upper(btrim(v_line ->> 'size')), '');
      v_reject_reason := nullif(btrim(v_line ->> 'reject_reason'), '');
      v_lost_reason := nullif(btrim(v_line ->> 'lost_reason'), '');

      select source.value into v_source_line
      from (
        select value, row_number() over (order by ordinal) as line_no
        from unnest(pg_catalog.string_to_array(pg_catalog.replace(coalesce(v_case.produk_diretur, ''), chr(13), ''), chr(10)))
          with ordinality as source_line(value, ordinal)
        where btrim(value) <> ''
      ) source
      where source.line_no = v_line_no;
      v_declared_qty := coalesce(substring(upper(v_source_line) from 'QTY:[[:space:]]*([0-9]+)')::integer, 1);

      if v_expected_qty is null or v_expected_qty <= 0 or v_expected_qty <> v_declared_qty
         or v_product_name is null
         or v_stored_qty < 0 or v_reject_qty < 0 or v_lost_qty < 0
         or v_stored_qty + v_reject_qty + v_lost_qty <> v_expected_qty then
        raise exception 'Inspect all quantities for case %, product %', v_case.kode_kejadian, v_line_no;
      end if;
      if v_reject_qty > 0 and v_reject_reason is null then
        raise exception 'Reject reason is required for case %, product %', v_case.kode_kejadian, v_line_no;
      end if;
      if v_lost_qty > 0 and v_lost_reason is null then
        raise exception 'Lost reason is required for case %, product %', v_case.kode_kejadian, v_line_no;
      end if;

      if v_stored_qty > 0 then
        if v_sku is null then
          raise exception 'SKU is required to store case %, product %', v_case.kode_kejadian, v_line_no;
        end if;

        insert into public.delivery_return_items (
          case_id, source_line_no, group_code, sku, product_name, size,
          expected_qty, outcome, qty, route_status, created_by, updated_by,
          handled_at, handled_by
        ) values (
          v_case.id, v_line_no, v_group, v_sku, v_product_name, v_size,
          v_expected_qty, 'STORED', v_stored_qty,
          'WAITING_SHELVING', v_actor, v_actor, null, null
        ) returning id into v_item_id;

        if v_group = 'ARKLINE' then
          v_sku_key := substring(pg_catalog.regexp_replace(v_sku, '[^A-Z0-9]', '', 'g') from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}');
          v_size_key := pg_catalog.regexp_replace(coalesce(v_size, ''), '[^A-Z0-9]', '', 'g');
          if v_sku_key is null or v_size_key = '' then
            raise exception 'Arkline SKU and size are required for case %, product %', v_case.kode_kejadian, v_line_no;
          end if;

          select count(distinct stock.rack_location_id) into v_location_count
          from public.warehouse_storage stock
          join public.dir_rack_locations location on location.id = stock.rack_location_id
          where upper(location.group_code) = 'ARKLINE'
            and upper(location.location_type) = 'SHELVING'
            and substring(pg_catalog.regexp_replace(upper(coalesce(stock.sku_id, stock.source_variant_code, '')), '[^A-Z0-9]', '', 'g') from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}') = v_sku_key
            and public.warehouse_sizes_match(stock.size, v_size);

          if v_location_count = 1 then
            select stock.id as storage_id, location.location_type, location.location_id,
                   location.location_code, location.sub_location
            into v_destination
            from public.warehouse_storage stock
            join public.dir_rack_locations location on location.id = stock.rack_location_id
            where upper(location.group_code) = 'ARKLINE'
              and upper(location.location_type) = 'SHELVING'
              and substring(pg_catalog.regexp_replace(upper(coalesce(stock.sku_id, stock.source_variant_code, '')), '[^A-Z0-9]', '', 'g') from '^ARK[0-9]{2}[A-Z]{3}[0-9]{3}') = v_sku_key
              and public.warehouse_sizes_match(stock.size, v_size)
            order by stock.id
            limit 1
            for update of stock;

            if v_destination.storage_id is null then
              raise exception 'Arkline shelving changed while processing case %', v_case.kode_kejadian;
            end if;

            update public.warehouse_storage
            set qty = coalesce(qty, 0) + v_stored_qty, updated_by = v_actor, updated_at = now()
            where id = v_destination.storage_id;

            update public.delivery_return_items
            set route_status = 'STORED', handled_at = now(), handled_by = v_actor
            where id = v_item_id;

            insert into public.warehouse_storage_movements (
              warehouse_storage_id, delivery_return_item_id, movement_type, qty,
              from_location_label, to_location_label, item_name, size, sku_id, created_by
            ) values (
              v_destination.storage_id, v_item_id, 'CUSTOMER_RETURN_IN', v_stored_qty,
              'CUSTOMER RETURN / ' || v_case.kode_kejadian,
              pg_catalog.concat_ws(' / ', v_destination.location_type, v_destination.location_id,
                v_destination.location_code, nullif(v_destination.sub_location, '')),
              v_product_name, v_size, v_sku, v_actor
            );
          end if;
        end if;

        if v_group <> 'ARKLINE' or v_location_count <> 1 then
          insert into public.warehouse_shelving_queue (
            delivery_return_item_id, source_location_label, sku_id, source_variant_code,
            item_name, size, group_code, qty, notes, created_by
          ) values (
            v_item_id, 'CUSTOMER RETURN / ' || v_case.kode_kejadian, v_sku, v_sku,
            v_product_name, v_size, v_group, v_stored_qty,
            'Return case ' || v_case.kode_kejadian, v_actor
          );
        end if;
      end if;

      if v_reject_qty > 0 then
        insert into public.delivery_return_items (
          case_id, source_line_no, group_code, sku, product_name, size,
          expected_qty, outcome, qty, route_status, reason, created_by, updated_by
        ) values (
          v_case.id, v_line_no, v_group, v_sku, v_product_name, v_size,
          v_expected_qty, 'REJECT', v_reject_qty, 'PENDING_ARRANGEMENT',
          v_reject_reason, v_actor, v_actor
        );
      end if;

      if v_lost_qty > 0 then
        insert into public.delivery_return_items (
          case_id, source_line_no, group_code, sku, product_name, size,
          expected_qty, outcome, qty, route_status, reason,
          created_by, updated_by, handled_at, handled_by
        ) values (
          v_case.id, v_line_no, v_group, v_sku, v_product_name, v_size,
          v_expected_qty, 'LOST', v_lost_qty, 'RECORDED', v_lost_reason,
          v_actor, v_actor,
          now(), v_actor
        );
      end if;
    end loop;

    -- The case row remains locked until both the return and replacement commit.
    for v_replacement in select * from public.delivery_return_product_lines(v_case.produk_pengganti) loop
      v_remaining := v_replacement.qty;
      foreach v_area_type in array array['RETUR_KEEPING', 'SALES'] loop
        for v_stock in
          select t.* from public.warehouse_temporary_sales_items t
          where t.status = 'IN_TEMPORARY_AREA'
            and coalesce(t.area_type, 'SALES') = v_area_type
            and upper(btrim(coalesce(t.group_code, 'MOB'))) = v_group
            and t.qty_in_area > 0
            and public.delivery_stock_product_matches(t.sku_id, t.source_variant_code, t.item_name,
              v_replacement.sku, v_replacement.product_name)
            and public.warehouse_sizes_match(t.size, v_replacement.size)
          order by t.entered_at, t.id
          for update of t
        loop
          exit when v_remaining <= 0;
          v_take := least(v_remaining, v_stock.qty_in_area);
          update public.warehouse_temporary_sales_items
          set qty_in_area = qty_in_area - v_take,
              status = case when qty_in_area = v_take then 'COMPLETED' else 'IN_TEMPORARY_AREA' end,
              updated_at = now()
          where id = v_stock.id;
          insert into public.warehouse_storage_movements (
            temporary_sales_item_id, movement_type, qty, from_location_label, to_location_label,
            item_name, size, sku_id, created_by
          ) values (
            v_stock.id, 'CUSTOMER_REPLACEMENT_OUT', v_take,
            case when v_area_type = 'RETUR_KEEPING' then 'TEMP. RETUR KEEPING'
              else 'TEMPORARY SALES AREA' end,
            'CUSTOMER REPLACEMENT / ' || v_case.kode_kejadian,
            v_stock.item_name, v_stock.size, v_stock.sku_id, v_actor
          );
          v_remaining := v_remaining - v_take;
        end loop;
      end loop;

      if v_remaining > 0 then
        for v_stock in
          select s.*, r.location_id, r.location_code, r.sub_location
          from public.warehouse_storage s
          join public.dir_rack_locations r on r.id = s.rack_location_id
          where upper(btrim(r.location_type)) = 'SHELVING'
            and upper(btrim(coalesce(r.group_code, 'MOB'))) = v_group and s.qty > 0
            and public.delivery_stock_product_matches(s.sku_id, s.source_variant_code, s.item_name,
              v_replacement.sku, v_replacement.product_name)
            and public.warehouse_sizes_match(s.size, v_replacement.size)
          order by s.created_at, s.id
          for update of s
        loop
          exit when v_remaining <= 0;
          v_take := least(v_remaining, v_stock.qty);
          insert into public.warehouse_storage_movements (
            warehouse_storage_id, movement_type, qty, from_location_label, to_location_label,
            item_name, size, sku_id, created_by
          ) values (
            v_stock.id, 'CUSTOMER_REPLACEMENT_OUT', v_take,
            concat_ws(' / ', 'SHELVING', v_stock.location_id, v_stock.location_code, nullif(v_stock.sub_location, '')),
            'CUSTOMER REPLACEMENT / ' || v_case.kode_kejadian,
            v_stock.item_name, v_stock.size, v_stock.sku_id, v_actor
          );
          if v_stock.qty = v_take and v_group <> 'ARKLINE' then
            delete from public.warehouse_storage where id = v_stock.id;
          else
            update public.warehouse_storage
            set qty = qty - v_take, updated_at = now(), updated_by = v_actor
            where id = v_stock.id;
          end if;
          v_remaining := v_remaining - v_take;
        end loop;
      end if;
      if v_remaining > 0 then
        -- Record the uncovered quantity only. Its external source is not verified,
        -- and may already have been deducted by a separate restock/pick operation.
        v_external_replacement_notes := concat_ws(chr(10), nullif(v_external_replacement_notes, ''),
          '[REPLACEMENT OUTSIDE STOCK] SKU: ' || coalesce(v_replacement.sku, '-')
          || ' || PRODUCT: ' || v_replacement.product_name
          || ' || SIZE: ' || coalesce(v_replacement.size, '-')
          || ' || QTY: ' || v_remaining::text);
      end if;
    end loop;

    update public.delivery_error_retur_cases
    set status_barang = 'Completed', updated_at = now(), updated_by = v_actor,
        stock_applied_at = now(),
        keterangan_tambahan = case when v_external_replacement_notes <> ''
          then concat_ws(chr(10), nullif(v_case.keterangan_tambahan, ''), v_external_replacement_notes)
          else v_case.keterangan_tambahan end
    where id = v_case.id;

    v_completed := v_completed + 1;
  end loop;

  return v_completed;
end;
$$;

revoke all on function public.complete_delivery_return_cases(jsonb) from public, anon;
grant execute on function public.complete_delivery_return_cases(jsonb) to authenticated;

-- Merge legacy lost details into the single reason field, then remove the old column.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'delivery_return_items'
      and column_name = 'actual_received_item'
  ) then
    execute $migration$
      update public.delivery_return_items
      set reason = concat_ws(' | ', nullif(btrim(reason), ''), nullif(btrim(actual_received_item), ''))
      where outcome = 'LOST'
        and nullif(btrim(actual_received_item), '') is not null
    $migration$;
    alter table public.delivery_return_items drop column actual_received_item;
  end if;
end;
$$;
