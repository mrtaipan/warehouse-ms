-- Remove the unused SKU catalog table and variant SKU references.
-- Run this after confirming dir_product_skus is no longer used.

begin;

-- Drop every foreign key that still points to dir_product_skus.
do $$
declare
  sku_table regclass := to_regclass('public.dir_product_skus');
  dependency record;
begin
  if sku_table is null then
    return;
  end if;

  for dependency in
    select
      conrelid::regclass as child_table,
      conname as constraint_name
    from pg_constraint
    where contype = 'f'
      and confrelid = sku_table
  loop
    execute format(
      'alter table %s drop constraint if exists %I',
      dependency.child_table,
      dependency.constraint_name
    );
  end loop;
end $$;

drop index if exists public.dir_product_model_variants_sku_idx;

alter table public.dir_product_model_variants
  drop column if exists sku_id,
  drop column if exists sku_code;

drop table if exists public.dir_product_skus;

commit;
