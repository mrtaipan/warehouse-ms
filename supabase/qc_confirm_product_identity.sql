-- Carry product catalog identity from QC confirmation into Packing List.
-- Run this before deploying code that reads qc_confirm.product_model_variant_id/source_variant_code.

alter table public.qc_confirm
  add column if not exists product_model_id bigint,
  add column if not exists product_model_variant_id bigint,
  add column if not exists source_variant_code text;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'qc_confirm'
      and constraint_name = 'qc_confirm_product_model_id_fkey'
  ) then
    alter table public.qc_confirm
      add constraint qc_confirm_product_model_id_fkey
      foreign key (product_model_id)
      references public.dir_product_models(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'qc_confirm'
      and constraint_name = 'qc_confirm_product_model_variant_id_fkey'
  ) then
    alter table public.qc_confirm
      add constraint qc_confirm_product_model_variant_id_fkey
      foreign key (product_model_variant_id)
      references public.dir_product_model_variants(id)
      on delete set null;
  end if;
end $$;

create index if not exists qc_confirm_product_model_id_idx
  on public.qc_confirm (product_model_id);

create index if not exists qc_confirm_product_model_variant_id_idx
  on public.qc_confirm (product_model_variant_id);

create index if not exists qc_confirm_source_variant_code_idx
  on public.qc_confirm (upper(source_variant_code))
  where source_variant_code is not null;

-- Earliest reliable source for QC Confirm: the QC tasks that fed the same GRN/koli/model.
with qc_item_candidates as (
  select
    c.id as qc_confirm_id,
    max(qi.product_model_id) as product_model_id,
    max(qi.product_model_variant_id) as product_model_variant_id,
    max(v.variant_code) as source_variant_code,
    count(distinct qi.product_model_variant_id) as match_count
  from public.qc_confirm c
  join public.qc_items qi
    on qi.inbound_id = c.inbound_id
   and upper(trim(coalesce(qi.model_name, ''))) = upper(trim(coalesce(c.model_name, '')))
   and upper(trim(coalesce(qi.variant_name, ''))) = upper(trim(coalesce(c.variant_name, '')))
  left join public.dir_product_model_variants v
    on v.id = qi.product_model_variant_id
  where (
    c.product_model_id is null
    or c.product_model_variant_id is null
    or nullif(trim(coalesce(c.source_variant_code, '')), '') is null
  )
    and qi.product_model_variant_id is not null
  group by c.id
),
unique_qc_item_candidates as (
  select qc_confirm_id, product_model_id, product_model_variant_id, source_variant_code
  from qc_item_candidates
  where match_count = 1
)
update public.qc_confirm c
set
  product_model_id = coalesce(c.product_model_id, u.product_model_id),
  product_model_variant_id = coalesce(c.product_model_variant_id, u.product_model_variant_id),
  source_variant_code = coalesce(
    nullif(trim(c.source_variant_code), ''),
    nullif(trim(u.source_variant_code), '')
  )
from unique_qc_item_candidates u
where u.qc_confirm_id = c.id;

-- Best source: rows already validated in PL Receiving.
update public.qc_confirm c
set
  product_model_id = coalesce(c.product_model_id, p.product_model_id),
  product_model_variant_id = coalesce(c.product_model_variant_id, p.product_model_variant_id),
  source_variant_code = coalesce(
    nullif(trim(c.source_variant_code), ''),
    nullif(trim(p.source_variant_code), '')
  )
from public.pl_receiving p
where p.source_qc_confirm_id = c.id
  and (
    c.product_model_id is null
    or c.product_model_variant_id is null
    or nullif(trim(coalesce(c.source_variant_code, '')), '') is null
  );

-- Fallback: uniquely match by inbound/brand/category/model/variant labels.
with variant_candidates as (
  select
    c.id as qc_confirm_id,
    m.id as product_model_id,
    v.id as product_model_variant_id,
    coalesce(nullif(trim(v.variant_code), ''), nullif(trim(v.variant_name), '')) as source_variant_code
  from public.qc_confirm c
  join public.dir_product_models m
    on upper(trim(m.model_name)) = upper(trim(c.model_name))
   and (c.brand_id is null or m.brand_id = c.brand_id)
   and (c.category_id is null or m.category_id = c.category_id)
  join public.dir_product_model_variants v
    on v.product_model_id = m.id
   and upper(trim(coalesce(c.variant_name, ''))) in (
     upper(trim(coalesce(v.variant_code, ''))),
     upper(trim(coalesce(v.variant_name, ''))),
     upper(trim(coalesce(v.selling_name, '')))
   )
  where (
    c.product_model_id is null
    or c.product_model_variant_id is null
    or nullif(trim(coalesce(c.source_variant_code, '')), '') is null
  )
),
unique_variant_candidates as (
  select
    qc_confirm_id,
    max(product_model_id) as product_model_id,
    max(product_model_variant_id) as product_model_variant_id,
    max(source_variant_code) as source_variant_code
  from variant_candidates
  group by qc_confirm_id
  having count(*) = 1
)
update public.qc_confirm c
set
  product_model_id = coalesce(c.product_model_id, u.product_model_id),
  product_model_variant_id = coalesce(c.product_model_variant_id, u.product_model_variant_id),
  source_variant_code = coalesce(
    nullif(trim(c.source_variant_code), ''),
    nullif(trim(u.source_variant_code), '')
  )
from unique_variant_candidates u
where u.qc_confirm_id = c.id;

select 'qc_confirm_missing_identity' as check_name, count(*) as row_count
from public.qc_confirm
where product_model_id is null
   or product_model_variant_id is null
   or nullif(trim(coalesce(source_variant_code, '')), '') is null;
