-- Change regular model_code sequencing from brand-only to brand + category.
-- Format: brand_code + sanitized category full_code + 3 digit sequence.
-- Example: CHM01SST001, CHM01SST002.

begin;

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

comment on column public.dir_product_models.model_code is
  'Regular internal model family code, generated per brand and category full code, e.g. CHM01SST001.';

comment on column public.dir_product_model_variants.variant_code is
  'Regular internal variant code generated from model_code, e.g. CHM01SST001001.';

commit;
