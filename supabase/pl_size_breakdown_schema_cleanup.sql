-- Packing List size breakdown schema cleanup.
-- Keeps old columns for safety, but moves the active flow to variant_name and PL fields.

begin;

alter table public.pl_size_breakdown
  add column if not exists variant_name text,
  add column if not exists product_model_id bigint references public.dir_product_models(id) on delete set null,
  add column if not exists product_model_variant_id bigint references public.dir_product_model_variants(id) on delete set null,
  add column if not exists source_variant_code text,
  add column if not exists pl_detail_seq integer,
  add column if not exists detail_order integer not null default 1,
  add column if not exists pl_name text,
  add column if not exists checker_names jsonb not null default '[]'::jsonb,
  add column if not exists pl_notes text,
  add column if not exists pl_photo_url text,
  add column if not exists pl_photo_urls jsonb not null default '[]'::jsonb,
  add column if not exists weight_value text,
  add column if not exists length_value text,
  add column if not exists width_value text,
  add column if not exists width_afterpull text,
  add column if not exists sleeve_length text,
  add column if not exists thigh_width text,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'model_color'
  ) then
    update public.pl_size_breakdown
    set variant_name = coalesce(nullif(variant_name, ''), nullif(model_color, ''))
    where variant_name is null
       or variant_name = '';
  end if;
end $$;

update public.pl_size_breakdown
set
  pl_name = coalesce(nullif(pl_name, ''), nullif(variant_name, ''), nullif(variant_label, ''), nullif(model_name, ''), 'PL Item'),
  pl_notes = coalesce(pl_notes, variant_notes),
  pl_photo_url = coalesce(pl_photo_url, variant_photo_url),
  detail_order = coalesce(detail_order, variant_index + 1, 1),
  checker_names = coalesce(checker_names, '[]'::jsonb)
where pl_name is null
   or pl_notes is null
   or pl_photo_url is null
   or detail_order is null
   or checker_names is null;

create index if not exists pl_size_breakdown_identity_idx
  on public.pl_size_breakdown (inbound_id, product_model_id, product_model_variant_id, pl_detail_seq);

drop index if exists public.pl_size_breakdown_display_idx;

create index if not exists pl_size_breakdown_detail_idx
  on public.pl_size_breakdown (inbound_id, product_model_id, product_model_variant_id, detail_order);

commit;

-- Optional cleanup after the app no longer needs old historical columns:
-- alter table public.pl_size_breakdown drop column if exists model_color;
-- alter table public.pl_size_breakdown drop column if exists variant_index;
-- alter table public.pl_size_breakdown drop column if exists variant_label;
-- alter table public.pl_size_breakdown drop column if exists variant_notes;
-- alter table public.pl_size_breakdown drop column if exists variant_photo_url;
-- alter table public.pl_size_breakdown drop column if exists sku_group_id;
-- alter table public.pl_size_breakdown drop column if exists promoted_at;
