-- Reset existing pl_size_breakdown schema without dropping the table.
-- Safe for the current case where pl_size_breakdown has no data.
-- This removes the old dependency that blocked DROP TABLE, drops unused legacy columns,
-- and keeps only the latest Packing List Size Breakdown structure used by the app.

begin;

-- Old SKU/promotion experiment created a dependency from variants to pl_size_breakdown.
-- Remove it so pl_size_breakdown can be reshaped safely.
alter table public.dir_product_model_variants
  drop constraint if exists dir_product_model_variants_promoted_from_pl_detail_id_fkey;

alter table public.dir_product_model_variants
  drop column if exists promoted_from_pl_detail_id;

-- No production data yet, so clear any accidental draft rows before reshaping.
truncate table public.pl_size_breakdown restart identity;

-- Remove legacy / no-longer-used PL breakdown columns.
alter table public.pl_size_breakdown
  drop column if exists source_koli_sequence,
  drop column if exists display_order,
  drop column if exists checker_name,
  drop column if exists extra_value_1,
  drop column if exists extra_value_2,
  drop column if exists extra_value_3,
  drop column if exists tigh_width,
  drop column if exists model_color,
  drop column if exists variant_index,
  drop column if exists variant_label,
  drop column if exists variant_notes,
  drop column if exists variant_photo_url,
  drop column if exists sku_group_id,
  drop column if exists promoted_at;

-- Add/normalize the latest active columns.
alter table public.pl_size_breakdown
  add column if not exists product_model_id bigint null references public.dir_product_models(id) on update cascade on delete set null,
  add column if not exists product_model_variant_id bigint null references public.dir_product_model_variants(id) on update cascade on delete set null,
  add column if not exists source_variant_code text null,
  add column if not exists model_name text null,
  add column if not exists variant_name text null,
  add column if not exists pl_detail_seq integer null,
  add column if not exists detail_order integer not null default 1,
  add column if not exists pl_name text null,
  add column if not exists pl_notes text null,
  add column if not exists pl_photo_url text null,
  add column if not exists pl_photo_urls jsonb not null default '[]'::jsonb,
  add column if not exists size_label text null,
  add column if not exists qty integer not null default 0,
  add column if not exists checker_names jsonb not null default '[]'::jsonb,
  add column if not exists weight_value text null,
  add column if not exists length_value text null,
  add column if not exists width_value text null,
  add column if not exists width_afterpull text null,
  add column if not exists sleeve_length text null,
  add column if not exists thigh_width text null,
  add column if not exists created_by text null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.pl_size_breakdown
set
  qty = coalesce(qty, 0),
  detail_order = coalesce(detail_order, 1),
  checker_names = coalesce(checker_names, '[]'::jsonb),
  pl_photo_urls = coalesce(pl_photo_urls, '[]'::jsonb),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.pl_size_breakdown
  alter column model_name drop not null,
  alter column variant_name drop not null,
  alter column size_label drop not null,
  alter column created_by drop not null,
  alter column qty set default 0,
  alter column qty set not null,
  alter column detail_order set default 1,
  alter column detail_order set not null,
  alter column checker_names set default '[]'::jsonb,
  alter column checker_names set not null,
  alter column pl_photo_urls set default '[]'::jsonb,
  alter column pl_photo_urls set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- Normalize constraints to the latest rules.
alter table public.pl_size_breakdown
  drop constraint if exists pl_size_breakdown_qty_check,
  drop constraint if exists pl_size_breakdown_display_order_check,
  drop constraint if exists pl_size_breakdown_detail_order_check,
  drop constraint if exists pl_size_breakdown_checker_names_array_check;

alter table public.pl_size_breakdown
  add constraint pl_size_breakdown_qty_check check (qty >= 0),
  add constraint pl_size_breakdown_detail_order_check check (detail_order >= 1),
  add constraint pl_size_breakdown_checker_names_array_check check (jsonb_typeof(checker_names) = 'array');

-- Rebuild useful indexes.
drop index if exists public.pl_size_breakdown_inbound_idx;
drop index if exists public.pl_size_breakdown_identity_idx;
drop index if exists public.pl_size_breakdown_display_idx;
drop index if exists public.pl_size_breakdown_detail_idx;
drop index if exists public.pl_size_breakdown_variant_name_idx;

create index pl_size_breakdown_inbound_idx
  on public.pl_size_breakdown (inbound_id);

create index pl_size_breakdown_identity_idx
  on public.pl_size_breakdown (inbound_id, product_model_id, product_model_variant_id, pl_detail_seq);

create index pl_size_breakdown_detail_idx
  on public.pl_size_breakdown (inbound_id, product_model_id, product_model_variant_id, detail_order);

create index pl_size_breakdown_variant_name_idx
  on public.pl_size_breakdown (variant_name);

commit;
