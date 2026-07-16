-- Persist the final MOB/OI target for every Packing List size row.
-- DEFAULT_RULE rows follow the current allocation algorithm.
-- MANUAL_OVERRIDE rows must keep the total equal to the breakdown qty.

begin;

alter table public.pl_size_breakdown
  add column if not exists mob_target_qty integer,
  add column if not exists oi_target_qty integer,
  add column if not exists allocation_source text default 'DEFAULT_RULE',
  add column if not exists allocation_reason text;

update public.pl_size_breakdown
set allocation_source = 'DEFAULT_RULE'
where allocation_source is null
   or btrim(allocation_source) = '';

alter table public.pl_size_breakdown
  alter column allocation_source set default 'DEFAULT_RULE',
  alter column allocation_source set not null;

-- Backfill existing rows. All PL details under the same catalog variant are
-- totaled first, while each saved size row keeps its own MOB/OI target.
with allocation_rows as (
  select
    id,
    greatest(coalesce(qty, 0), 0)::integer as row_qty,
    sum(greatest(coalesce(qty, 0), 0)) over (
      partition by
        inbound_id,
        case
          when product_model_variant_id is not null then 'VARIANT:' || product_model_variant_id::text
          when product_model_id is not null then 'MODEL:' || product_model_id::text
          else 'LEGACY:' || upper(coalesce(model_name, '')) || ':' || upper(coalesce(variant_name, ''))
        end
    )::integer as model_variant_qty
  from public.pl_size_breakdown
)
update public.pl_size_breakdown as breakdown
set
  mob_target_qty = case
    when allocation.model_variant_qty <= 15 then 0
    when allocation.model_variant_qty <= 80 then allocation.row_qty
    else greatest(0, allocation.row_qty - ceil(allocation.row_qty * 0.15)::integer)
  end,
  oi_target_qty = case
    when allocation.model_variant_qty <= 15 then allocation.row_qty
    when allocation.model_variant_qty <= 80 then 0
    else ceil(allocation.row_qty * 0.15)::integer
  end,
  allocation_reason = null
from allocation_rows as allocation
where breakdown.id = allocation.id
  and breakdown.allocation_source = 'DEFAULT_RULE';

alter table public.pl_size_breakdown
  drop constraint if exists pl_size_breakdown_mob_target_qty_check,
  drop constraint if exists pl_size_breakdown_oi_target_qty_check,
  drop constraint if exists pl_size_breakdown_allocation_source_check,
  drop constraint if exists pl_size_breakdown_allocation_target_pair_check,
  drop constraint if exists pl_size_breakdown_allocation_total_check,
  drop constraint if exists pl_size_breakdown_manual_reason_check;

alter table public.pl_size_breakdown
  add constraint pl_size_breakdown_mob_target_qty_check
    check (mob_target_qty is null or mob_target_qty >= 0),
  add constraint pl_size_breakdown_oi_target_qty_check
    check (oi_target_qty is null or oi_target_qty >= 0),
  add constraint pl_size_breakdown_allocation_source_check
    check (allocation_source in ('DEFAULT_RULE', 'MANUAL_OVERRIDE')),
  add constraint pl_size_breakdown_allocation_target_pair_check
    check (
      (mob_target_qty is null and oi_target_qty is null)
      or (mob_target_qty is not null and oi_target_qty is not null)
    ),
  add constraint pl_size_breakdown_allocation_total_check
    check (
      mob_target_qty is null
      or mob_target_qty + oi_target_qty = greatest(coalesce(qty, 0), 0)
    ),
  add constraint pl_size_breakdown_manual_reason_check
    check (
      allocation_source <> 'MANUAL_OVERRIDE'
      or nullif(btrim(allocation_reason), '') is not null
    );

comment on column public.pl_size_breakdown.mob_target_qty is
  'Final target qty assigned to MOB for this saved size row.';
comment on column public.pl_size_breakdown.oi_target_qty is
  'Final target qty assigned to OI for this saved size row.';
comment on column public.pl_size_breakdown.allocation_source is
  'DEFAULT_RULE for algorithm results or MANUAL_OVERRIDE for user adjustments.';
comment on column public.pl_size_breakdown.allocation_reason is
  'Required explanation when allocation_source is MANUAL_OVERRIDE.';

commit;
