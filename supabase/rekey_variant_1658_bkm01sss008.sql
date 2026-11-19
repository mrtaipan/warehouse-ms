-- One-time catalog correction for variant 1658. Run only after the photo script's
-- prepare step has copied and verified bkm01sss008-001.jpg.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $rekey$
declare
  v_table regclass;
  v_reference record;
  v_found boolean;
  v_changed integer;
begin
  -- Block writes to identity-bearing tables while checking every reference.
  for v_table in
    select distinct c.oid::regclass
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and a.attnum > 0 and not a.attisdropped
      and a.attname in (
        'product_model_variant_id', 'source_product_model_variant_id',
        'variant_code', 'source_variant_code', 'sku_id', 'sku', 'source_sku_id'
      )
    order by c.oid::regclass
  loop
    execute format('lock table %s in share row exclusive mode nowait', v_table);
  end loop;

  if not exists (
    select 1 from public.dir_product_model_variants v
    join public.dir_product_models m on m.id = v.product_model_id
    where v.id = 1658 and v.product_model_id = 369
      and m.model_code = 'BKM01SSS008'
      and v.variant_code = 'BKM01SSS001-005'
      and v.variant_photo_url =
        'https://gzgwsfnsjgzxhpmqfqyj.supabase.co/storage/v1/object/public/product-photos/bkm/01/s-ss/bkm01sss008/bkm01sss001-005.jpg'
  ) then
    raise exception 'Variant 1658 changed since the audit; no correction was made.';
  end if;

  if exists (
    select 1 from public.dir_product_model_variants
    where upper(variant_code) = 'BKM01SSS008-001'
  ) then
    raise exception 'BKM01SSS008-001 is already taken.';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'product-photos'
      and name = 'bkm/01/s-ss/bkm01sss008/bkm01sss008-001.jpg'
  ) then
    raise exception 'Prepared photo is not present in Storage.';
  end if;

  for v_reference in
    select c.oid::regclass as relation_name, a.attname as column_name,
      a.attname in ('product_model_variant_id', 'source_product_model_variant_id') as is_id
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and a.attnum > 0 and not a.attisdropped
      and c.relname <> 'dir_product_model_variants'
      and a.attname in (
        'product_model_variant_id', 'source_product_model_variant_id',
        'variant_code', 'source_variant_code', 'sku_id', 'sku', 'source_sku_id'
      )
    order by c.oid::regclass, a.attname
  loop
    if v_reference.is_id then
      execute format('select exists (select 1 from %s where %I = $1)',
        v_reference.relation_name, v_reference.column_name)
        into v_found using 1658::bigint;
    else
      execute format(
        'select exists (select 1 from %s where upper(trim(%I::text)) = $1 or left(upper(trim(%I::text)), length($1) + 1) = $1 || ''-'')',
        v_reference.relation_name, v_reference.column_name, v_reference.column_name
      ) into v_found using 'BKM01SSS001-005';
    end if;
    if v_found then
      raise exception 'Variant is already used in %; SKU cannot be rekeyed.', v_reference.relation_name;
    end if;
  end loop;

  if exists (
    select 1 from public.product_variant_identity_events e
    where e.target_variant_id = 1658 or 1658 = any(e.source_variant_ids)
       or 1658 = any(e.created_variant_ids)
  ) then
    raise exception 'Variant 1658 already has a merge or split event.';
  end if;

  update public.dir_product_model_variants
  set variant_code = 'BKM01SSS008-001',
      variant_photo_url =
        'https://gzgwsfnsjgzxhpmqfqyj.supabase.co/storage/v1/object/public/product-photos/bkm/01/s-ss/bkm01sss008/bkm01sss008-001.jpg?rev=20261119-1658',
      updated_at = now(),
      updated_by = 'SYSTEM: SKU correction BKM01SSS001-005 to BKM01SSS008-001'
  where id = 1658 and product_model_id = 369
    and variant_code = 'BKM01SSS001-005';
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then
    raise exception 'Expected exactly one variant to change, got %.', v_changed;
  end if;
end;
$rekey$;

commit;
