-- Run after rack_location_picking_shelf.sql. Patch the currently deployed
-- function bodies so later warehouse hotfixes are preserved. Each replacement
-- asserts its expected count and is safe to rerun.
do $migration$
declare
  routine record;
  patch record;
  definition text;
  old_count integer;
  new_count integer;
  changed boolean;
  routine_count integer := 0;
begin
  for routine in
    select p.oid, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in (
        'cleanup_arkline_shelving_zero_duplicates',
        'cleanup_arkline_shelving_zero_duplicates_trigger',
        'complete_arkline_restock_request',
        'complete_delivery_return_cases',
        'complete_priority_return_restock_request',
        'register_arkline_rejection_storage_item',
        'retry_arkline_sales_import_batch',
        'retry_upload_sales_import_batch',
        'settle_arkline_sales_import_batch',
        'settle_mob_sales_import_batch',
        'store_arkline_delivery_rejects',
        'store_reqc_grade_a_results'
      )
    order by p.proname
  loop
    routine_count := routine_count + 1;
    definition := pg_get_functiondef(routine.oid);
    changed := false;

    for patch in
      select * from (values
        ('cleanup_arkline_shelving_zero_duplicates',
          $old$and upper(trim(coalesce(rl.location_type, ''))) = 'SHELVING'$old$,
          $new$and upper(trim(coalesce(rl.location_type, ''))) = 'SHELVING' and rl.is_picking_shelf$new$, 1),
        ('cleanup_arkline_shelving_zero_duplicates_trigger',
          $old$and upper(trim(coalesce(rl.location_type, ''))) = 'SHELVING'$old$,
          $new$and upper(trim(coalesce(rl.location_type, ''))) = 'SHELVING' and rl.is_picking_shelf$new$, 1),
        ('complete_arkline_restock_request',
          $old$if upper(coalesce(v_source_location.location_type, '')) <> 'PALLET' then$old$,
          $new$if upper(coalesce(v_source_location.location_type, '')) not in ('PALLET', 'SHELVING') or v_source_location.is_picking_shelf then$new$, 1),
        ('complete_arkline_restock_request',
          $old$or upper(coalesce(v_source_location.location_type, '')) = 'PALLET')$old$,
          $new$or not v_source_location.is_picking_shelf)$new$, 1),
        ('complete_arkline_restock_request',
          $old$and upper(coalesce(location.location_type, '')) = 'SHELVING'$old$,
          $new$and upper(coalesce(location.location_type, '')) = 'SHELVING' and location.is_picking_shelf$new$, 2),
        ('complete_delivery_return_cases',
          $old$and upper(location.location_type) = 'SHELVING'$old$,
          $new$and upper(location.location_type) = 'SHELVING' and location.is_picking_shelf$new$, 2),
        ('complete_delivery_return_cases',
          $old$where upper(btrim(r.location_type)) = 'SHELVING'$old$,
          $new$where upper(btrim(r.location_type)) = 'SHELVING' and r.is_picking_shelf$new$, 1),
        ('complete_priority_return_restock_request',
          $old$and upper(btrim(v_location.location_type)) = 'SHELVING'$old$,
          $new$and upper(btrim(v_location.location_type)) = 'SHELVING' and v_location.is_picking_shelf$new$, 1),
        ('register_arkline_rejection_storage_item',
          $old$and upper(coalesce(location.location_type, '')) = 'SHELVING'$old$,
          $new$and upper(coalesce(location.location_type, '')) = 'SHELVING' and location.is_picking_shelf$new$, 1),
        ('register_arkline_rejection_storage_item',
          $old$or upper(coalesce(v_location.location_type, '')) <> 'SHELVING'$old$,
          $new$or upper(coalesce(v_location.location_type, '')) <> 'SHELVING' or not v_location.is_picking_shelf$new$, 1),
        ('register_arkline_rejection_storage_item',
          $old$or upper(coalesce(v_request.take_from, '')) not like 'PALLET%'$old$,
          $new$or (upper(coalesce(v_request.take_from, '')) not like 'PALLET%' and upper(coalesce(v_request.take_from, '')) not like 'SHELVING%')$new$, 1),
        ('retry_arkline_sales_import_batch',
          $old$and upper(coalesce(location.location_type, '')) = 'SHELVING'$old$,
          $new$and upper(coalesce(location.location_type, '')) = 'SHELVING' and location.is_picking_shelf$new$, 3),
        ('retry_upload_sales_import_batch',
          $old$where upper(trim(coalesce(location.location_type, ''))) = 'SHELVING'$old$,
          $new$where upper(trim(coalesce(location.location_type, ''))) = 'SHELVING' and location.is_picking_shelf$new$, 1),
        ('settle_arkline_sales_import_batch',
          $old$and upper(coalesce(location.location_type, '')) = 'SHELVING'$old$,
          $new$and upper(coalesce(location.location_type, '')) = 'SHELVING' and location.is_picking_shelf$new$, 3),
        ('settle_mob_sales_import_batch',
          $old$where upper(trim(coalesce(location.location_type, ''))) = 'SHELVING'$old$,
          $new$where upper(trim(coalesce(location.location_type, ''))) = 'SHELVING' and location.is_picking_shelf$new$, 1),
        ('store_arkline_delivery_rejects',
          $old$and upper(location.location_type) = 'SHELVING'$old$,
          $new$and upper(location.location_type) = 'SHELVING' and location.is_picking_shelf$new$, 2),
        ('store_reqc_grade_a_results',
          $old$if location_row.id is null or upper(coalesce(location_row.location_type, '')) <> 'PALLET' then$old$,
          $new$if location_row.id is null or upper(coalesce(location_row.location_type, '')) not in ('PALLET', 'SHELVING') or location_row.is_picking_shelf then$new$, 1)
      ) as changes(function_name, old_text, new_text, expected_count)
      where changes.function_name = routine.proname
    loop
      old_count := (length(definition) - length(replace(definition, patch.old_text, ''))) / length(patch.old_text);
      new_count := (length(definition) - length(replace(definition, patch.new_text, ''))) / length(patch.new_text);

      if new_count = patch.expected_count then
        continue;
      end if;
      if old_count <> patch.expected_count or new_count <> 0 then
        raise exception 'Unexpected % pattern: old %, new %, expected %',
          routine.proname, old_count, new_count, patch.expected_count;
      end if;
      definition := replace(definition, patch.old_text, patch.new_text);
      changed := true;
    end loop;

    if changed then
      execute definition;
    end if;
  end loop;

  if routine_count <> 12 then
    raise exception 'Expected 12 warehouse functions, found %', routine_count;
  end if;
end;
$migration$;
