begin;

-- Backfill missing PL SKU identity without guessing ambiguous variants.
-- Run this once after product variants and PL rows are already in place.

update public.pl_receiving r
set
  product_model_id = coalesce(r.product_model_id, c.product_model_id),
  product_model_variant_id = coalesce(r.product_model_variant_id, c.product_model_variant_id),
  source_variant_code = coalesce(
    nullif(trim(r.source_variant_code), ''),
    nullif(trim(c.source_variant_code), '')
  )
from public.qc_confirm c
where r.source_qc_confirm_id = c.id
  and (
    r.product_model_id is null
    or r.product_model_variant_id is null
    or nullif(trim(coalesce(r.source_variant_code, '')), '') is null
  );

with receiving_identity_candidates as (
  select
    b.id as breakdown_id,
    max(r.product_model_id) as product_model_id,
    max(r.product_model_variant_id) as product_model_variant_id,
    max(r.source_variant_code) as source_variant_code,
    count(*) as match_count
  from public.pl_size_breakdown b
  join public.pl_receiving r
    on r.inbound_id = b.inbound_id
   and (
      b.product_model_id is null
      or r.product_model_id = b.product_model_id
   )
   and upper(trim(coalesce(b.model_name, ''))) = upper(trim(coalesce(r.model_name, '')))
   and upper(trim(coalesce(nullif(b.variant_name, ''), nullif(b.pl_name, ''), ''))) in (
      upper(trim(coalesce(r.variant_name, ''))),
      upper(trim(coalesce(r.source_variant_code, '')))
   )
  where (
    b.product_model_id is null
    or b.product_model_variant_id is null
    or nullif(trim(coalesce(b.source_variant_code, '')), '') is null
  )
    and r.product_model_variant_id is not null
  group by b.id
),
unique_receiving_identity_candidates as (
  select breakdown_id, product_model_id, product_model_variant_id, source_variant_code
  from receiving_identity_candidates
  where match_count = 1
)
update public.pl_size_breakdown b
set
  product_model_id = coalesce(b.product_model_id, u.product_model_id),
  product_model_variant_id = coalesce(b.product_model_variant_id, u.product_model_variant_id),
  source_variant_code = coalesce(
    nullif(trim(b.source_variant_code), ''),
    nullif(trim(u.source_variant_code), '')
  ),
  updated_at = now()
from unique_receiving_identity_candidates u
where b.id = u.breakdown_id;

with variant_by_code as (
  select
    v.id,
    v.product_model_id,
    nullif(trim(v.variant_code), '') as variant_code,
    nullif(trim(v.variant_name), '') as variant_name
  from public.dir_product_model_variants v
),
breakdown_code_match as (
  select
    b.id as breakdown_id,
    max(v.id) as variant_id,
    count(*) as match_count
  from public.pl_size_breakdown b
  join variant_by_code v
    on upper(trim(coalesce(b.source_variant_code, ''))) in (
      upper(trim(coalesce(v.variant_code, ''))),
      upper(trim(coalesce(v.variant_name, '')))
    )
   and (
      b.product_model_id is null
      or v.product_model_id = b.product_model_id
    )
  where b.product_model_variant_id is null
    and nullif(trim(coalesce(b.source_variant_code, '')), '') is not null
  group by b.id
),
unique_breakdown_code_match as (
  select breakdown_id, variant_id
  from breakdown_code_match
  where match_count = 1
)
update public.pl_size_breakdown b
set
  product_model_variant_id = m.variant_id,
  source_variant_code = coalesce(nullif(trim(b.source_variant_code), ''), nullif(trim(v.variant_code), ''), nullif(trim(v.variant_name), '')),
  updated_at = now()
from unique_breakdown_code_match m
join public.dir_product_model_variants v on v.id = m.variant_id
where b.id = m.breakdown_id;

with variant_by_label as (
  select
    v.id,
    v.product_model_id,
    nullif(trim(v.variant_code), '') as variant_code,
    upper(trim(coalesce(v.selling_name, ''))) as selling_name_key,
    upper(trim(coalesce(v.variant_name, ''))) as variant_name_key,
    upper(trim(coalesce(v.variant_code, ''))) as variant_code_key
  from public.dir_product_model_variants v
),
breakdown_label_match as (
  select
    b.id as breakdown_id,
    max(v.id) as variant_id,
    count(*) as match_count
  from public.pl_size_breakdown b
  join variant_by_label v
    on v.product_model_id = b.product_model_id
   and upper(trim(coalesce(nullif(b.variant_name, ''), nullif(b.pl_name, ''), ''))) in (
      v.selling_name_key,
      v.variant_name_key,
      v.variant_code_key
    )
  where b.product_model_variant_id is null
    and b.product_model_id is not null
    and upper(trim(coalesce(nullif(b.variant_name, ''), nullif(b.pl_name, ''), ''))) <> ''
  group by b.id
),
unique_breakdown_label_match as (
  select breakdown_id, variant_id
  from breakdown_label_match
  where match_count = 1
)
update public.pl_size_breakdown b
set
  product_model_variant_id = m.variant_id,
  source_variant_code = coalesce(nullif(trim(b.source_variant_code), ''), nullif(trim(v.variant_code), ''), nullif(trim(v.variant_name), '')),
  updated_at = now()
from unique_breakdown_label_match m
join public.dir_product_model_variants v on v.id = m.variant_id
where b.id = m.breakdown_id;

update public.pl_size_breakdown b
set
  source_variant_code = coalesce(nullif(trim(b.source_variant_code), ''), nullif(trim(v.variant_code), ''), nullif(trim(v.variant_name), '')),
  updated_at = now()
from public.dir_product_model_variants v
where b.product_model_variant_id = v.id
  and nullif(trim(coalesce(b.source_variant_code, '')), '') is null
  and coalesce(nullif(trim(v.variant_code), ''), nullif(trim(v.variant_name), '')) is not null;

update public.pl_packing_items p
set
  product_model_id = coalesce(p.product_model_id, b.product_model_id, v.product_model_id),
  product_model_variant_id = coalesce(p.product_model_variant_id, b.product_model_variant_id),
  source_variant_code = coalesce(nullif(trim(p.source_variant_code), ''), nullif(trim(b.source_variant_code), ''), nullif(trim(v.variant_code), ''), nullif(trim(v.variant_name), '')),
  pl_detail_seq = coalesce(p.pl_detail_seq, b.pl_detail_seq),
  detail_order = coalesce(p.detail_order, b.detail_order),
  updated_at = now()
from public.pl_size_breakdown b
left join public.dir_product_model_variants v
  on v.id = b.product_model_variant_id
where p.pl_size_breakdown_id = b.id
  and (
    p.product_model_id is null
    or p.product_model_variant_id is null
    or nullif(trim(coalesce(p.source_variant_code, '')), '') is null
    or p.pl_detail_seq is null and b.pl_detail_seq is not null
    or p.detail_order is null and b.detail_order is not null
  );

-- Summary after backfill. Any remaining rows need manual product identity resolution.
select
  'pl_size_breakdown_missing_identity' as check_name,
  count(*) as row_count
from public.pl_size_breakdown
where product_model_variant_id is null
   or nullif(trim(coalesce(source_variant_code, '')), '') is null
union all
select
  'pl_packing_items_missing_identity' as check_name,
  count(*) as row_count
from public.pl_packing_items
where product_model_variant_id is null
   or nullif(trim(coalesce(source_variant_code, '')), '') is null;

commit;
