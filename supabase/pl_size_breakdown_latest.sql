-- Latest Packing List Size Breakdown table shape.
-- Run this after the current pl_size_breakdown table exists.
-- This keeps legacy columns for safety, but the active app flow uses:
-- variant_name, pl_name, size_label, checker_names, measurement fields,
-- pl_photo_url as main photo, and pl_photo_urls as detail photo gallery URLs.

begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'display_order'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'detail_order'
  ) then
    alter table public.pl_size_breakdown rename column display_order to detail_order;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'display_order'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'detail_order'
  ) then
    update public.pl_size_breakdown
    set detail_order = coalesce(detail_order, display_order, 1)
    where detail_order is null;

    alter table public.pl_size_breakdown drop column display_order;
  end if;
end $$;

alter table public.pl_size_breakdown
  add column if not exists product_model_id bigint references public.dir_product_models(id) on update cascade on delete set null,
  add column if not exists product_model_variant_id bigint references public.dir_product_model_variants(id) on update cascade on delete set null,
  add column if not exists source_variant_code text,
  add column if not exists variant_name text,
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
  add column if not exists created_at timestamptz not null default now(),
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
  checker_names = coalesce(checker_names, '[]'::jsonb),
  pl_photo_urls = coalesce(pl_photo_urls, '[]'::jsonb),
  updated_at = coalesce(updated_at, now())
where pl_name is null
   or pl_notes is null
   or pl_photo_url is null
   or detail_order is null
   or checker_names is null
   or pl_photo_urls is null
   or updated_at is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'checker_name'
  ) then
    update public.pl_size_breakdown
    set checker_names = to_jsonb(
      array(
        select distinct btrim(item)
        from unnest(string_to_array(checker_name, ',')) as item
        where btrim(item) <> ''
      )
    )
    where jsonb_array_length(checker_names) = 0
      and checker_name is not null
      and btrim(checker_name) <> '';

    alter table public.pl_size_breakdown drop column checker_name;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'extra_value_1'
  ) then
    update public.pl_size_breakdown
    set width_afterpull = coalesce(width_afterpull, extra_value_1)
    where width_afterpull is null
      and extra_value_1 is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'extra_value_2'
  ) then
    update public.pl_size_breakdown
    set sleeve_length = coalesce(sleeve_length, extra_value_2)
    where sleeve_length is null
      and extra_value_2 is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'extra_value_3'
  ) then
    update public.pl_size_breakdown
    set thigh_width = coalesce(thigh_width, extra_value_3)
    where thigh_width is null
      and extra_value_3 is not null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pl_size_breakdown'
      and column_name = 'tigh_width'
  ) then
    update public.pl_size_breakdown
    set thigh_width = coalesce(thigh_width, tigh_width)
    where thigh_width is null
      and tigh_width is not null;

    alter table public.pl_size_breakdown drop column tigh_width;
  end if;

  alter table public.pl_size_breakdown
    drop column if exists extra_value_1,
    drop column if exists extra_value_2,
    drop column if exists extra_value_3;
end $$;

alter table public.pl_size_breakdown
  drop constraint if exists pl_size_breakdown_qty_check;

alter table public.pl_size_breakdown
  add constraint pl_size_breakdown_qty_check
  check (qty is null or qty >= 0);

alter table public.pl_size_breakdown
  drop constraint if exists pl_size_breakdown_display_order_check,
  drop constraint if exists pl_size_breakdown_detail_order_check;

alter table public.pl_size_breakdown
  add constraint pl_size_breakdown_detail_order_check
  check (detail_order >= 1);

alter table public.pl_size_breakdown
  drop constraint if exists pl_size_breakdown_checker_names_array_check;

alter table public.pl_size_breakdown
  add constraint pl_size_breakdown_checker_names_array_check
  check (jsonb_typeof(checker_names) = 'array');

create index if not exists pl_size_breakdown_inbound_idx
  on public.pl_size_breakdown (inbound_id);

create index if not exists pl_size_breakdown_identity_idx
  on public.pl_size_breakdown (inbound_id, product_model_id, product_model_variant_id, pl_detail_seq);

drop index if exists public.pl_size_breakdown_display_idx;

create index if not exists pl_size_breakdown_detail_idx
  on public.pl_size_breakdown (inbound_id, product_model_id, product_model_variant_id, detail_order);

create index if not exists pl_size_breakdown_variant_name_idx
  on public.pl_size_breakdown (variant_name);

commit;

-- Optional cleanup after confirming no old flow needs these legacy columns:
-- alter table public.pl_size_breakdown drop column if exists model_color;
-- alter table public.pl_size_breakdown drop column if exists variant_index;
-- alter table public.pl_size_breakdown drop column if exists variant_label;
-- alter table public.pl_size_breakdown drop column if exists variant_notes;
-- alter table public.pl_size_breakdown drop column if exists variant_photo_url;
-- alter table public.pl_size_breakdown drop column if exists sku_group_id;
-- alter table public.pl_size_breakdown drop column if exists promoted_at;
