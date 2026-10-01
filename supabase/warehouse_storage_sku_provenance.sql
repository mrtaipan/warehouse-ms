-- Preserve the original PL identity while resolving the current SKU for
-- operational destinations such as warehouse_storage and Temporary Sales.

alter table public.warehouse_storage
  add column if not exists source_pl_packing_item_id bigint null,
  add column if not exists source_variant_code text null;

alter table public.warehouse_temporary_sales_items
  add column if not exists source_variant_code text null;

create index if not exists warehouse_storage_source_pl_item_idx
  on public.warehouse_storage (source_pl_packing_item_id);

create index if not exists warehouse_temporary_sales_source_pl_item_idx
  on public.warehouse_temporary_sales_items (source_pl_packing_item_id);

create or replace function public.resolve_pl_packing_item_sku(p_pl_packing_item_id bigint)
returns text
language sql
security invoker
set search_path = ''
as $$
  with recursive source_row as (
    select
      p.product_model_variant_id,
      p.inbound_id,
      coalesce(p.pl_detail_seq, p.detail_order, 1) as source_detail_seq,
      p.source_variant_code
    from public.pl_packing_items p
    where p.id = p_pl_packing_item_id
  ),
  split_assignment as (
    select (assignment.value ->> 'assigned_variant_id')::bigint as variant_id
    from source_row source
    join public.product_variant_identity_events event
      on event.event_type = 'split'
    cross join lateral jsonb_array_elements(event.detail_assignments) assignment(value)
    where (assignment.value ->> 'source_variant_id')::bigint = source.product_model_variant_id
      and (assignment.value ->> 'inbound_id')::bigint = source.inbound_id
      and coalesce((assignment.value ->> 'source_detail_seq')::integer, 1) = source.source_detail_seq
    order by event.created_at desc, event.id desc
    limit 1
  ),
  start_variant as (
    select coalesce(
      (select variant_id from split_assignment),
      source.product_model_variant_id
    ) as variant_id
    from source_row source
  ),
  variant_chain as (
    select
      variant.id,
      variant.variant_code,
      variant.merged_into_variant_id,
      0 as depth
    from public.dir_product_model_variants variant
    join start_variant start on start.variant_id = variant.id

    union all

    select
      next_variant.id,
      next_variant.variant_code,
      next_variant.merged_into_variant_id,
      chain.depth + 1
    from variant_chain chain
    join public.dir_product_model_variants next_variant
      on next_variant.id = chain.merged_into_variant_id
    where chain.depth < 32
  )
  select coalesce(
    (select nullif(trim(chain.variant_code), '') from variant_chain chain order by chain.depth desc limit 1),
    (select nullif(trim(source.source_variant_code), '') from source_row source)
  );
$$;

create or replace function public.apply_storage_sku_provenance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_sku text;
  source_sku text;
begin
  if new.source_pl_packing_item_id is null then
    return new;
  end if;

  select nullif(trim(p.source_variant_code), '')
    into source_sku
  from public.pl_packing_items p
  where p.id = new.source_pl_packing_item_id;

  resolved_sku := public.resolve_pl_packing_item_sku(new.source_pl_packing_item_id);
  new.source_variant_code := coalesce(new.source_variant_code, source_sku);
  new.sku_id := coalesce(nullif(trim(resolved_sku), ''), new.sku_id, new.source_variant_code);
  return new;
end;
$$;

drop trigger if exists warehouse_storage_sku_provenance_trigger
  on public.warehouse_storage;

create trigger warehouse_storage_sku_provenance_trigger
before insert or update of source_pl_packing_item_id, sku_id
on public.warehouse_storage
for each row
execute function public.apply_storage_sku_provenance();

drop trigger if exists warehouse_temporary_sales_sku_provenance_trigger
  on public.warehouse_temporary_sales_items;

create trigger warehouse_temporary_sales_sku_provenance_trigger
before insert or update of source_pl_packing_item_id, sku_id
on public.warehouse_temporary_sales_items
for each row
execute function public.apply_storage_sku_provenance();

grant execute on function public.resolve_pl_packing_item_sku(bigint) to authenticated;

