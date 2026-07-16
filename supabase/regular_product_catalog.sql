-- Regular product catalog structure.
-- This keeps the catalog to 3 business tables:
-- 1. dir_product_models
-- 2. dir_product_model_variants
-- 3. dir_product_skus
--
-- Model code is an internal family code generated per brand + category full code:
--   CHM01SST001, CHM01SST002, ...
-- Variant code is an internal variant code generated per model:
--   CHM01SST001-001, CHM01SST001-002, ...
-- SKU code is the warehouse/business SKU in dir_product_skus. Multiple variants can point
-- to one SKU when the business decides the physical differences should be counted
-- as the same stock item.

begin;

alter table public.dir_product_models
  add column if not exists model_code text,
  add column if not exists model_notes text;

alter table public.dir_product_model_variants
  add column if not exists variant_code text,
  add column if not exists sku_id bigint references public.dir_product_skus(id),
  add column if not exists variant_attributes jsonb not null default '{}'::jsonb;

alter table public.dir_product_skus
  add column if not exists product_family text,
  add column if not exists sku_notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dir_product_skus_parent_sku_id_fkey'
      and conrelid = 'public.dir_product_skus'::regclass
  ) then
    alter table public.dir_product_skus
      add constraint dir_product_skus_parent_sku_id_fkey
      foreign key (parent_sku_id)
      references public.dir_product_skus(id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dir_product_skus_parent_not_self'
      and conrelid = 'public.dir_product_skus'::regclass
  ) then
    alter table public.dir_product_skus
      add constraint dir_product_skus_parent_not_self
      check (parent_sku_id is null or parent_sku_id <> id);
  end if;
end $$;

create unique index if not exists dir_product_models_model_code_uidx
  on public.dir_product_models (upper(model_code))
  where model_code is not null;

create unique index if not exists dir_product_model_variants_variant_code_uidx
  on public.dir_product_model_variants (upper(variant_code))
  where variant_code is not null;

create unique index if not exists dir_product_skus_sku_code_uidx
  on public.dir_product_skus (upper(sku_code))
  where sku_code is not null;

create index if not exists dir_product_model_variants_model_idx
  on public.dir_product_model_variants (product_model_id, is_active);

create index if not exists dir_product_model_variants_sku_idx
  on public.dir_product_model_variants (sku_id);

create index if not exists dir_product_skus_parent_sku_idx
  on public.dir_product_skus (parent_sku_id);

drop function if exists public.generate_regular_model_code(bigint);

create or replace function public.generate_regular_model_code(p_brand_id bigint, p_category_id bigint)
returns text
language plpgsql
as $$
declare
  v_brand_code text;
  v_category_code text;
  v_prefix text;
  v_next_number integer;
begin
  if p_brand_id is null then
    raise exception 'brand_id is required to generate regular model_code.';
  end if;

  if p_category_id is null then
    raise exception 'category_id is required to generate regular model_code.';
  end if;

  select upper(nullif(trim(brand_code), ''))
    into v_brand_code
  from public.dir_brands
  where id = p_brand_id;

  if v_brand_code is null then
    v_brand_code := 'BRD' || p_brand_id::text;
  end if;

  select upper(nullif(regexp_replace(trim(coalesce(full_code, category_code, '')), '[^A-Za-z0-9]', '', 'g'), ''))
    into v_category_code
  from public.dir_categories
  where id = p_category_id;

  if v_category_code is null then
    v_category_code := 'CAT' || p_category_id::text;
  end if;

  v_prefix := v_brand_code || v_category_code;

  perform pg_advisory_xact_lock(hashtext('regular-model-code:' || v_prefix));

  select coalesce(max(suffix::integer), 0) + 1
    into v_next_number
  from (
    select substring(upper(model_code) from length(v_prefix) + 1) as suffix
    from public.dir_product_models
    where brand_id = p_brand_id
      and category_id = p_category_id
      and left(upper(model_code), length(v_prefix)) = v_prefix
  ) model_codes
  where suffix ~ '^[0-9]+$';

  if v_next_number > 999 then
    raise exception 'Model code sequence for % already reached 999. Please review the model registry before adding more models.', v_prefix;
  end if;

  return v_prefix || lpad(v_next_number::text, 3, '0');
end;
$$;

create or replace function public.set_regular_model_code()
returns trigger
language plpgsql
as $$
begin
  if new.model_code is null or trim(new.model_code) = '' then
    new.model_code := public.generate_regular_model_code(new.brand_id, new.category_id);
  end if;

  new.model_code := upper(trim(new.model_code));
  return new;
end;
$$;

drop trigger if exists trg_set_regular_model_code on public.dir_product_models;
create trigger trg_set_regular_model_code
before insert on public.dir_product_models
for each row
execute function public.set_regular_model_code();

create or replace function public.generate_regular_variant_code(p_product_model_id bigint)
returns text
language plpgsql
as $$
declare
  v_model_code text;
  v_next_number integer;
begin
  if p_product_model_id is null then
    raise exception 'product_model_id is required to generate regular variant_code.';
  end if;

  select upper(nullif(trim(model_code), ''))
    into v_model_code
  from public.dir_product_models
  where id = p_product_model_id;

  if v_model_code is null then
    raise exception 'Product model % has no model_code.', p_product_model_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('regular-variant-code:' || v_model_code));

  select coalesce(max(suffix::integer), 0) + 1
    into v_next_number
  from (
    select substring(upper(variant_code) from length(v_model_code) + 2) as suffix
    from public.dir_product_model_variants
    where product_model_id = p_product_model_id
      and left(upper(variant_code), length(v_model_code) + 1) = v_model_code || '-'
  ) variant_codes
  where suffix ~ '^[0-9]+$';

  if v_next_number > 999 then
    raise exception 'Variant code sequence for % already reached 999. Please review the variant registry before adding more variants.', v_model_code;
  end if;

  return v_model_code || '-' || lpad(v_next_number::text, 3, '0');
end;
$$;

create or replace function public.set_regular_variant_code()
returns trigger
language plpgsql
as $$
begin
  if new.variant_code is null or trim(new.variant_code) = '' then
    new.variant_code := public.generate_regular_variant_code(new.product_model_id);
  end if;

  new.variant_code := upper(trim(new.variant_code));
  return new;
end;
$$;

drop trigger if exists trg_set_regular_variant_code on public.dir_product_model_variants;
create trigger trg_set_regular_variant_code
before insert on public.dir_product_model_variants
for each row
execute function public.set_regular_variant_code();

comment on column public.dir_product_models.model_code is
  'Regular internal model family code, generated per brand and category full code, e.g. CHM01SST001.';

comment on column public.dir_product_model_variants.variant_code is
  'Regular internal variant code generated from model_code, e.g. CHM01SST001-001.';

comment on column public.dir_product_model_variants.sku_id is
  'Final business/warehouse SKU. Multiple variants may point to the same SKU if they are merged operationally.';

comment on column public.dir_product_skus.parent_sku_id is
  'Canonical SKU pointer for SKU merges. Null means this SKU is canonical.';

-- Later cleanup, after UI/code no longer reads old columns:
-- alter table public.dir_product_models drop column if exists model_color;
-- alter table public.dir_product_models drop column if exists photo_url;
-- alter table public.dir_product_models drop column if exists sku_code;

commit;
