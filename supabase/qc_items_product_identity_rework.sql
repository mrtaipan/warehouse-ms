-- QC regular allocation product identity rework.
-- Keep model_name, variant_name, and photo_url as historical snapshots.
-- Add product catalog references and replacement audit fields.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'qc_items'
      and column_name = 'model_color'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'qc_items'
      and column_name = 'variant_name'
  ) then
    alter table public.qc_items rename column model_color to variant_name;
  end if;
end $$;

alter table public.qc_items
  add column if not exists variant_name text,
  add column if not exists product_model_id bigint,
  add column if not exists product_model_variant_id bigint,
  add column if not exists original_model_name text,
  add column if not exists original_variant_name text,
  add column if not exists model_replaced boolean not null default false;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'qc_items'
      and column_name = 'model_color'
  ) then
    execute 'update public.qc_items set variant_name = coalesce(variant_name, model_color) where variant_name is null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'qc_items'
      and column_name = 'original_model_color'
  ) then
    execute 'update public.qc_items set original_variant_name = coalesce(original_variant_name, original_model_color) where original_variant_name is null';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'qc_items'
      and constraint_name = 'qc_items_product_model_id_fkey'
  ) then
    alter table public.qc_items
      add constraint qc_items_product_model_id_fkey
      foreign key (product_model_id)
      references public.dir_product_models(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'qc_items'
      and constraint_name = 'qc_items_product_model_variant_id_fkey'
  ) then
    alter table public.qc_items
      add constraint qc_items_product_model_variant_id_fkey
      foreign key (product_model_variant_id)
      references public.dir_product_model_variants(id)
      on delete set null;
  end if;
end $$;

create index if not exists qc_items_inbound_unload_id_idx
  on public.qc_items (inbound_unload_id);

create index if not exists qc_items_product_model_id_idx
  on public.qc_items (product_model_id);

create index if not exists qc_items_product_model_variant_id_idx
  on public.qc_items (product_model_variant_id);

-- Optional cleanup after every QC page has been migrated and verified:
-- alter table public.qc_items drop column if exists model_color;
-- alter table public.qc_items drop column if exists original_model_color;
