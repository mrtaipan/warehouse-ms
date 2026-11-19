-- Keep database-generated codes consistent with the Inbound registry, including reuse
-- of a code vacated by a permitted pre-QC model move.
create or replace function public.generate_regular_variant_code(p_product_model_id bigint)
returns text
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_model_code text;
  v_candidate text;
  v_number integer;
begin
  select upper(nullif(trim(model_code), '')) into v_model_code
  from public.dir_product_models where id = p_product_model_id;
  if v_model_code is null then
    raise exception 'The product model has no model code.';
  end if;

  perform pg_advisory_xact_lock(hashtext('regular-variant-code:' || v_model_code));
  for v_number in 1..999 loop
    v_candidate := v_model_code || '-' || lpad(v_number::text, 3, '0');
    if not exists (
      select 1 from public.dir_product_model_variants
      where upper(variant_code) = v_candidate
    ) then
      return v_candidate;
    end if;
  end loop;

  raise exception 'Variant codes for % have reached 999.', v_model_code;
end;
$function$;

-- Deploy before using the Move Model action. Only the server's service-role client may call it.
create or replace function public.move_inbound_variant_model(
  p_variant_id bigint,
  p_target_model_id bigint,
  p_expected_old_code text,
  p_new_code text,
  p_expected_old_photo_url text,
  p_new_photo_url text,
  p_updated_by text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $function$
declare
  v_variant public.dir_product_model_variants%rowtype;
  v_source public.dir_product_models%rowtype;
  v_target public.dir_product_models%rowtype;
  v_table regclass;
  v_reference record;
  v_found boolean;
  v_expected_code text;
  v_old_code text;
  v_new_code text;
  v_inbound_count integer;
  v_sample_count integer;
  v_photo_path text;
begin
  if p_variant_id is null or p_target_model_id is null or nullif(trim(p_updated_by), '') is null then
    raise exception 'Variant, target model, and actor are required.';
  end if;

  -- Lock every public table that can hold a variant identity so a concurrent QC or
  -- packing operation cannot start after the downstream check but before the move.
  for v_table in
    select distinct c.oid::regclass
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and a.attnum > 0 and not a.attisdropped
      and a.attname in (
        'product_model_variant_id', 'source_product_model_variant_id',
        'variant_code', 'source_variant_code', 'sku_id', 'sku', 'source_sku_id',
        'inbound_unload_id', 'source_variant_ids', 'target_variant_id',
        'created_variant_ids', 'sample_breakdown_id'
      )
    order by c.oid::regclass
  loop
    execute format('lock table %s in share row exclusive mode nowait', v_table);
  end loop;

  select * into v_variant from public.dir_product_model_variants where id = p_variant_id for update;
  if not found or not coalesce(v_variant.is_active, false) then
    raise exception 'Variant is no longer available.';
  end if;

  select * into v_source from public.dir_product_models where id = v_variant.product_model_id;
  select * into v_target from public.dir_product_models where id = p_target_model_id;
  if v_target.id is null or not coalesce(v_target.is_active, false) then
    raise exception 'Target model is no longer available.';
  end if;
  if v_source.id = v_target.id then
    raise exception 'Choose a different target model.';
  end if;
  if v_source.brand_id is distinct from v_target.brand_id
     or v_source.category_id is distinct from v_target.category_id then
    raise exception 'Move Model only supports the same brand and category.';
  end if;

  v_old_code := upper(trim(v_variant.variant_code));
  v_new_code := upper(trim(p_new_code));
  if v_old_code is distinct from upper(trim(p_expected_old_code))
     or v_variant.variant_photo_url is distinct from p_expected_old_photo_url then
    raise exception 'Variant changed while Move Model was open. Refresh and retry.';
  end if;

  if left(v_new_code, length(v_target.model_code) + 1) <> upper(v_target.model_code) || '-'
     or substring(v_new_code from length(v_target.model_code) + 2) !~ '^[0-9]{3}$'
     or right(v_new_code, 3) = '000' then
    raise exception 'The new variant code must match the target model and end in 001-999.';
  end if;

  if v_new_code <> v_old_code then
    select upper(v_target.model_code) || '-' || lpad(n::text, 3, '0')
      into v_expected_code
    from generate_series(1, 999) as n
    where not exists (
      select 1 from public.dir_product_model_variants v
      where upper(v.variant_code) = upper(v_target.model_code) || '-' || lpad(n::text, 3, '0')
    )
    order by n limit 1;

    if v_expected_code is null or v_new_code <> v_expected_code then
      raise exception 'Variant code availability changed. Refresh and retry.';
    end if;
  end if;

  if exists (
    select 1 from public.inbound_unload u
    where u.product_model_variant_id = p_variant_id
      and (upper(coalesce(u.qc_receiving_status, 'OPEN')) <> 'OPEN'
           or u.qc_receiving_closed_at is not null)
  ) then
    raise exception 'This variant has already entered QC receiving and its SKU cannot change.';
  end if;

  if exists (
    select 1 from public.qc_items q
    where q.product_model_variant_id = p_variant_id
       or q.inbound_unload_id in (
         select u.id from public.inbound_unload u where u.product_model_variant_id = p_variant_id
       )
  ) or exists (
    select 1 from public.qc_sample_breakdowns q
    where q.sample_breakdown_id in (
      select b.id from public.inbound_sample_model_breakdowns b
      where b.product_model_variant_id = p_variant_id
    )
  ) or exists (
    select 1 from public.inbound_sample_model_breakdowns b
    join public.qc_items q on q.inbound_unload_id = b.inbound_unload_id
    where b.product_model_variant_id = p_variant_id
  ) or exists (
    select 1 from public.inbound_sample_model_breakdowns b
    where b.product_model_variant_id = p_variant_id
      and b.resolution_status in ('split_done', 'full_return')
  ) then
    raise exception 'This variant has already entered QC and its SKU cannot change.';
  end if;

  -- Older rows may not have a variant ID. Do not rekey if their identity is ambiguous.
  if exists (
    select 1 from public.qc_items q
    where q.inbound_id in (
      select u.inbound_id from public.inbound_unload u where u.product_model_variant_id = p_variant_id
    ) and q.product_model_variant_id is null and q.inbound_unload_id is null
  ) then
    raise exception 'Legacy QC rows in a related GRN need manual review before moving this variant.';
  end if;

  if exists (
    select 1 from public.inbound_unload u
    where u.product_model_variant_id is null
      and u.brand_id = v_source.brand_id
      and u.category_id = v_source.category_id
      and upper(trim(u.model_name)) = upper(trim(v_source.model_name))
      and upper(trim(coalesce(u.variant_name, ''))) in (
        upper(trim(v_variant.variant_name)),
        upper(trim(coalesce(v_variant.selling_name, '')))
      )
  ) then
    raise exception 'Legacy inbound rows with the same model and variant need manual review before moving this SKU.';
  end if;

  for v_table in
    select unnest(array[
      'public.qc_confirm'::regclass,
      'public.pl_receiving'::regclass,
      'public.pl_size_breakdown'::regclass,
      'public.pl_packing_items'::regclass,
      'public.warehouse_returns'::regclass
    ])
  loop
    execute format(
      'select exists (select 1 from %s d where d.product_model_variant_id is null and d.inbound_id in '
      || '(select inbound_id from public.inbound_unload where product_model_variant_id = $1) '
      || 'and upper(trim(d.model_name)) = $2 and upper(trim(coalesce(d.variant_name, ''''))) in ($3, $4))',
      v_table
    ) into v_found using p_variant_id, upper(trim(v_source.model_name)),
      upper(trim(v_variant.variant_name)), upper(trim(coalesce(v_variant.selling_name, '')));

    if v_found then
      raise exception 'Legacy % rows need manual review before moving this SKU.', v_table;
    end if;
  end loop;

  for v_reference in
    select c.oid::regclass as relation_name, a.attname as column_name,
      a.attname in ('product_model_variant_id', 'source_product_model_variant_id', 'target_variant_id') as is_id
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and a.attnum > 0 and not a.attisdropped
      and c.relname not in (
        'dir_product_model_variants', 'inbound_unload', 'inbound_sample_model_breakdowns'
      )
      and a.attname in (
        'product_model_variant_id', 'source_product_model_variant_id',
        'target_variant_id', 'variant_code', 'source_variant_code',
        'sku_id', 'sku', 'source_sku_id'
      )
    order by c.oid::regclass, a.attname
  loop
    if v_reference.is_id then
      execute format(
        'select exists (select 1 from %s where %I = $1)',
        v_reference.relation_name, v_reference.column_name
      ) into v_found using p_variant_id;
    else
      execute format(
        'select exists (select 1 from %s where upper(trim(%I::text)) = $1 or left(upper(trim(%I::text)), length($1) + 1) = $1 || ''-'')',
        v_reference.relation_name, v_reference.column_name, v_reference.column_name
      ) into v_found using v_old_code;
    end if;

    if v_found then
      raise exception 'Variant is already used in %, so its SKU cannot change.', v_reference.relation_name;
    end if;
  end loop;

  if exists (
    select 1 from public.product_variant_identity_events e
    where p_variant_id = any(e.source_variant_ids)
       or p_variant_id = any(e.created_variant_ids)
  ) then
    raise exception 'Variant identity has already been recorded in a merge or split event.';
  end if;

  if p_expected_old_photo_url is null then
    if p_new_photo_url is not null then
      raise exception 'A photo cannot be attached during Move Model.';
    end if;
  else
    if p_new_photo_url is null then
      raise exception 'The photo must match the target model and code before moving.';
    end if;
    v_photo_path := split_part(split_part(p_new_photo_url, '/product-photos/', 2), '?', 1);
    if v_photo_path = '' or lower(v_photo_path) not like '%/' || lower(v_target.model_code) || '/' || lower(v_new_code) || '.%'
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'product-photos' and o.name = v_photo_path
       ) then
      raise exception 'The new variant photo is missing or does not match the new SKU.';
    end if;
  end if;

  update public.dir_product_model_variants
  set product_model_id = v_target.id,
      variant_code = v_new_code,
      variant_photo_url = p_new_photo_url,
      updated_by = trim(p_updated_by)
  where id = p_variant_id;

  update public.inbound_unload
  set product_model_id = v_target.id,
      model_name = v_target.model_name,
      variant_name = coalesce(nullif(v_variant.selling_name, ''), v_variant.variant_name),
      photo_url = p_new_photo_url,
      updated_at = now()
  where product_model_variant_id = p_variant_id;
  get diagnostics v_inbound_count = row_count;

  update public.inbound_sample_model_breakdowns
  set product_model_id = v_target.id,
      model_name = v_target.model_name,
      variant_name = coalesce(nullif(v_variant.selling_name, ''), v_variant.variant_name),
      photo_url = p_new_photo_url,
      updated_at = now(),
      updated_by = trim(p_updated_by)
  where product_model_variant_id = p_variant_id;
  get diagnostics v_sample_count = row_count;

  return jsonb_build_object(
    'variant_id', p_variant_id,
    'old_code', v_old_code,
    'new_code', v_new_code,
    'inbound_rows', v_inbound_count,
    'sample_rows', v_sample_count
  );
end;
$function$;

revoke all on function public.move_inbound_variant_model(bigint, bigint, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.move_inbound_variant_model(bigint, bigint, text, text, text, text, text)
  to service_role;
