begin;

alter table public.pl_packing_items
  add column if not exists release_status text,
  add column if not exists released_at timestamp with time zone,
  add column if not exists released_by text;

alter table public.pl_packing_items
  alter column release_status set default 'draft';

update public.pl_packing_items
set release_status = 'draft'
where release_status is null;

alter table public.pl_packing_items
  alter column release_status set not null;

alter table public.pl_packing_items
  drop constraint if exists pl_packing_items_release_status_check;

alter table public.pl_packing_items
  add constraint pl_packing_items_release_status_check
  check (release_status in ('draft', 'released'));

create index if not exists pl_packing_items_release_status_idx
  on public.pl_packing_items (release_status, inbound_id, product_model_variant_id);

alter table public.dir_product_model_variants
  add column if not exists release_status text,
  add column if not exists released_at timestamp with time zone,
  add column if not exists released_by text,
  add column if not exists release_count integer,
  add column if not exists release_history jsonb;

alter table public.dir_product_model_variants
  alter column release_status set default 'draft';

alter table public.dir_product_model_variants
  alter column release_count set default 0;

alter table public.dir_product_model_variants
  alter column release_history set default '[]'::jsonb;

update public.dir_product_model_variants
set
  release_status = coalesce(release_status, 'draft'),
  release_count = coalesce(release_count, 0),
  release_history = coalesce(release_history, '[]'::jsonb)
where release_status is null
   or release_count is null
   or release_history is null;

with batch_release_events as (
  select
    product_model_variant_id,
    coalesce(released_at, updated_at, created_at, now()) as released_at,
    nullif(trim(released_by), '') as released_by,
    sum(qty) as qty,
    array_agg(id order by id) as pl_packing_item_ids
  from public.pl_packing_items
  where product_model_variant_id is not null
    and release_status = 'released'
  group by
    product_model_variant_id,
    coalesce(released_at, updated_at, created_at, now()),
    nullif(trim(released_by), '')
),
numbered_batch_release_events as (
  select
    *,
    row_number() over (
      partition by product_model_variant_id
      order by released_at, released_by nulls last
    ) as release_sequence
  from batch_release_events
),
release_summary as (
  select
    product_model_variant_id,
    count(*)::integer as release_count,
    max(released_at) as released_at,
    (array_agg(released_by order by released_at desc nulls last))[1] as released_by,
    jsonb_agg(
      jsonb_build_object(
        'release_count', release_sequence,
        'released_at', released_at,
        'released_by', released_by,
        'qty', qty,
        'pl_packing_item_ids', pl_packing_item_ids
      )
      order by released_at
    ) as release_history
  from numbered_batch_release_events
  group by product_model_variant_id
)
update public.dir_product_model_variants variants
set
  release_status = 'released',
  released_at = coalesce(variants.released_at, release_summary.released_at),
  released_by = coalesce(variants.released_by, release_summary.released_by),
  release_count = greatest(coalesce(variants.release_count, 0), release_summary.release_count),
  release_history = case
    when variants.release_history is null then release_summary.release_history
    when jsonb_typeof(variants.release_history) <> 'array' then release_summary.release_history
    when jsonb_array_length(variants.release_history) = 0 then release_summary.release_history
    else variants.release_history
  end,
  updated_at = greatest(
    coalesce(variants.updated_at, '-infinity'::timestamp with time zone),
    coalesce(release_summary.released_at, now())
  )
from release_summary
where variants.id = release_summary.product_model_variant_id;

alter table public.dir_product_model_variants
  alter column release_status set not null;

alter table public.dir_product_model_variants
  alter column release_count set not null;

alter table public.dir_product_model_variants
  alter column release_history set not null;

alter table public.dir_product_model_variants
  drop constraint if exists dir_product_model_variants_release_status_check;

alter table public.dir_product_model_variants
  add constraint dir_product_model_variants_release_status_check
  check (release_status in ('draft', 'released'));

alter table public.dir_product_model_variants
  drop constraint if exists dir_product_model_variants_release_count_check;

alter table public.dir_product_model_variants
  add constraint dir_product_model_variants_release_count_check
  check (release_count >= 0);

create index if not exists dir_product_model_variants_release_status_idx
  on public.dir_product_model_variants (release_status, product_model_id, is_active);

drop index if exists public.pl_packing_items_photo_queue_status_idx;
drop index if exists public.pl_packing_items_photo_workflow_idx;

alter table public.pl_packing_items
  drop constraint if exists pl_packing_items_photo_queue_status_check;

alter table public.pl_packing_items
  drop column if exists photo_queue_status,
  drop column if exists photo_queue_submitted_at,
  drop column if exists photo_queue_submitted_by,
  drop column if exists release_count,
  drop column if exists release_history;

comment on column public.dir_product_model_variants.release_status is
  'Master product release status. Batch-level release history remains on pl_packing_items.release_status, released_at, and released_by.';

comment on column public.dir_product_model_variants.released_at is
  'Latest master release timestamp for this product variant.';

comment on column public.dir_product_model_variants.released_by is
  'User label that last marked this product variant as released.';

comment on column public.dir_product_model_variants.release_count is
  'Number of release actions recorded for this product variant.';

comment on column public.dir_product_model_variants.release_history is
  'Release action history for this product variant. Each entry captures timestamp, actor, qty, GRN list, and PL batch rows where available.';

commit;
