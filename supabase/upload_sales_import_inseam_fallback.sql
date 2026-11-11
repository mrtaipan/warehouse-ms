-- Run once before retrying skipped MOB/OI upload lines. Safe to rerun.
-- Patches the deployed functions in place, preserving later workflow fixes.
create or replace function public.warehouse_upload_size_priority(
  p_stock_size text, p_uploaded_size text, p_variation_raw text default null
)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when public.warehouse_sizes_match(p_stock_size, p_uploaded_size, p_variation_raw) then 0
    when (public.warehouse_size_aliases(p_uploaded_size))[1] ~ '^[0-9]{2,3}$'
      and (public.warehouse_size_aliases(p_stock_size))[1]
        ~ ('^' || (public.warehouse_size_aliases(p_uploaded_size))[1] || 'X[0-9]{2}$') then 1
    else null
  end;
$$;

revoke all on function public.warehouse_upload_size_priority(text, text, text) from public, anon;
grant execute on function public.warehouse_upload_size_priority(text, text, text) to authenticated, service_role;

do $migration$
declare
  routine_name text;
  routine_oid oid;
  definition text;
  old_text text;
  new_text text;
  old_count integer;
  new_count integer;
begin
  foreach routine_name in array array['settle_mob_sales_import_batch', 'retry_upload_sales_import_batch'] loop
    routine_oid := to_regprocedure(format('public.%I(uuid,text)', routine_name));
    if routine_oid is null then
      raise exception 'Upload function % is missing', routine_name;
    end if;
    definition := pg_get_functiondef(routine_oid);

    for old_text, new_text in
      select * from (values
        ('public.warehouse_sizes_match(temporary_item.size, import_line.size, import_line.variation_raw)',
         'public.warehouse_upload_size_priority(temporary_item.size, import_line.size, import_line.variation_raw) is not null'),
        ('public.warehouse_sizes_match(storage.size, import_line.size, import_line.variation_raw)',
         'public.warehouse_upload_size_priority(storage.size, import_line.size, import_line.variation_raw) is not null'),
        ('order by temporary_item.entered_at asc nulls first, temporary_item.id asc',
         'order by public.warehouse_upload_size_priority(temporary_item.size, import_line.size, import_line.variation_raw) asc nulls last, temporary_item.entered_at asc nulls first, temporary_item.id asc'),
        ('order by storage.created_at asc nulls first, storage.id asc',
         'order by public.warehouse_upload_size_priority(storage.size, import_line.size, import_line.variation_raw) asc nulls last, storage.created_at asc nulls first, storage.id asc')
      ) as patterns(old_pattern, new_pattern)
    loop
      old_count := (length(definition) - length(replace(definition, old_text, ''))) / length(old_text);
      new_count := (length(definition) - length(replace(definition, new_text, ''))) / length(new_text);
      if new_count = 1 and old_count = 0 then
        continue;
      end if;
      if old_count <> 1 or new_count <> 0 then
        raise exception 'Unexpected % pattern (old %, new %): %', routine_name, old_count, new_count, old_text;
      end if;
      definition := replace(definition, old_text, new_text);
    end loop;

    execute definition;
  end loop;
end;
$migration$;

-- Confirm that only the intended waist/inseam fallback was added.
select
  public.warehouse_upload_size_priority('32', '32') as exact_size,
  public.warehouse_upload_size_priority('32x30', '32') as inseam_fallback,
  public.warehouse_upload_size_priority('34x30', '32') as different_waist,
  public.warehouse_upload_size_priority('32', '32x30') as reverse_mismatch;
