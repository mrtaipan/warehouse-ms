-- Add product registry identity to inbound_unload.
-- Keeps model_name, variant_name, and photo_url as historical/display snapshots.

begin;

alter table public.inbound_unload
  add column if not exists product_model_id bigint null,
  add column if not exists product_model_variant_id bigint null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'inbound_unload'
      and constraint_name = 'inbound_unload_product_model_id_fkey'
  ) then
    alter table public.inbound_unload
      add constraint inbound_unload_product_model_id_fkey
      foreign key (product_model_id)
      references public.dir_product_models(id)
      on update cascade
      on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'inbound_unload'
      and constraint_name = 'inbound_unload_product_model_variant_id_fkey'
  ) then
    alter table public.inbound_unload
      add constraint inbound_unload_product_model_variant_id_fkey
      foreign key (product_model_variant_id)
      references public.dir_product_model_variants(id)
      on update cascade
      on delete set null;
  end if;
end $$;

do $$
declare
  iu_variant_terms text[] := array[]::text[];
  v_variant_terms text[] := array[]::text[];
  iu_variant_expr text;
  v_variant_expr text;
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inbound_unload' and column_name = 'variant_code'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dir_product_model_variants' and column_name = 'variant_code'
  ) then
    execute $sql$
      update public.inbound_unload iu
      set
        product_model_variant_id = v.id,
        product_model_id = v.product_model_id
      from public.dir_product_model_variants v
      where iu.product_model_variant_id is null
        and nullif(trim(iu.variant_code), '') is not null
        and upper(trim(v.variant_code)) = upper(trim(iu.variant_code))
    $sql$;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inbound_unload' and column_name = 'variant_name'
  ) then
    iu_variant_terms := array_append(iu_variant_terms, 'nullif(trim(iu.variant_name), '''')');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inbound_unload' and column_name = 'variant_label'
  ) then
    iu_variant_terms := array_append(iu_variant_terms, 'nullif(trim(iu.variant_label), '''')');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inbound_unload' and column_name = 'variant_code'
  ) then
    iu_variant_terms := array_append(iu_variant_terms, 'nullif(trim(iu.variant_code), '''')');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inbound_unload' and column_name = 'model_color'
  ) then
    iu_variant_terms := array_append(iu_variant_terms, 'nullif(trim(iu.model_color), '''')');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dir_product_model_variants' and column_name = 'variant_name'
  ) then
    v_variant_terms := array_append(v_variant_terms, 'nullif(trim(v.variant_name), '''')');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dir_product_model_variants' and column_name = 'variant_label'
  ) then
    v_variant_terms := array_append(v_variant_terms, 'nullif(trim(v.variant_label), '''')');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dir_product_model_variants' and column_name = 'variant_code'
  ) then
    v_variant_terms := array_append(v_variant_terms, 'nullif(trim(v.variant_code), '''')');
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'dir_product_model_variants' and column_name = 'selling_name'
  ) then
    v_variant_terms := array_append(v_variant_terms, 'nullif(trim(v.selling_name), '''')');
  end if;

  if array_length(iu_variant_terms, 1) > 0 and array_length(v_variant_terms, 1) > 0 then
    iu_variant_expr := 'coalesce(' || array_to_string(iu_variant_terms, ', ') || ', '''')';
    v_variant_expr := 'coalesce(' || array_to_string(v_variant_terms, ', ') || ', '''')';

    execute format(
      $sql$
        update public.inbound_unload iu
        set
          product_model_variant_id = v.id,
          product_model_id = m.id
        from public.dir_product_models m
        join public.dir_product_model_variants v
          on v.product_model_id = m.id
        where iu.product_model_variant_id is null
          and iu.brand_id = m.brand_id
          and iu.category_id = m.category_id
          and upper(trim(iu.model_name)) = upper(trim(m.model_name))
          and upper(trim(%s)) = upper(trim(%s))
      $sql$,
      iu_variant_expr,
      v_variant_expr
    );
  end if;
end $$;

update public.inbound_unload iu
set product_model_id = m.id
from public.dir_product_models m
where iu.product_model_id is null
  and iu.brand_id = m.brand_id
  and iu.category_id = m.category_id
  and upper(trim(iu.model_name)) = upper(trim(m.model_name));

create index if not exists inbound_unload_product_model_idx
  on public.inbound_unload (product_model_id);

create index if not exists inbound_unload_product_model_variant_idx
  on public.inbound_unload (product_model_variant_id);

create index if not exists inbound_unload_inbound_product_identity_idx
  on public.inbound_unload (inbound_id, product_model_id, product_model_variant_id);

comment on column public.inbound_unload.product_model_id is
  'Registry model identity from dir_product_models. model_name remains a display snapshot.';

comment on column public.inbound_unload.product_model_variant_id is
  'Registry variant identity from dir_product_model_variants. variant_name and variant_code remain display/source snapshots.';

commit;
