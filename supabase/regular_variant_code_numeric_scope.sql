-- Change regular variant_code sequencing to MODEL_CODE-XXX.
-- Format: model_code + hyphen + 3 digit sequence.
-- Example: CHM01SST001-001, CHM01SST001-002.

begin;

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

comment on column public.dir_product_model_variants.variant_code is
  'Regular internal variant code generated from model_code, e.g. CHM01SST001-001.';

commit;
