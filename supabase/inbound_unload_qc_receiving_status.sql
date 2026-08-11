alter table public.qc_items
  drop constraint if exists qc_items_receiving_status_check;

alter table public.qc_items
  drop column if exists receiving_status,
  drop column if exists receiving_closed_at,
  drop column if exists receiving_closed_by;

alter table public.inbound_unload
  add column if not exists qc_receiving_status text not null default 'OPEN',
  add column if not exists qc_receiving_closed_at timestamptz null,
  add column if not exists qc_receiving_closed_by text null;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'inbound_unload'
      and constraint_name = 'inbound_unload_qc_receiving_status_check'
  ) then
    alter table public.inbound_unload
      add constraint inbound_unload_qc_receiving_status_check
      check (qc_receiving_status in ('OPEN', 'CLOSED'));
  end if;
end $$;

with product_totals as (
  select
    inbound_unload_id,
    coalesce(
      'variant:' || nullif(product_model_variant_id::text, ''),
      'model:' || nullif(product_model_id::text, ''),
      'text:' || upper(trim(coalesce(model_name, ''))) || '::' || upper(trim(coalesce(variant_name, '')))
    ) as product_key,
    max(coalesce(expected_qty, 0)) as expected_qty,
    max(coalesce(qty_in, 0)) as qc_in_qty
  from public.qc_items
  where inbound_unload_id is not null
  group by
    inbound_unload_id,
    coalesce(
      'variant:' || nullif(product_model_variant_id::text, ''),
      'model:' || nullif(product_model_id::text, ''),
      'text:' || upper(trim(coalesce(model_name, ''))) || '::' || upper(trim(coalesce(variant_name, '')))
    )
),
source_totals as (
  select
    inbound_unload_id,
    sum(expected_qty) as expected_qty,
    sum(qc_in_qty) as qc_in_qty
  from product_totals
  group by inbound_unload_id
)
update public.inbound_unload iu
set qc_receiving_status = 'CLOSED',
    qc_receiving_closed_at = coalesce(iu.qc_receiving_closed_at, now())
from source_totals st
where iu.id = st.inbound_unload_id
  and iu.qc_receiving_status = 'OPEN'
  and st.qc_in_qty >= st.expected_qty;
