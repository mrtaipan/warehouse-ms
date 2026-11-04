create or replace function public.generate_arkline_sku(p_category_id bigint)
returns text
language plpgsql
set search_path = ''
as $$
declare
  category_code text;
  sku_prefix text;
  next_number integer;
begin
  select upper(full_code) into category_code
  from public.dir_categories
  where id = p_category_id and is_active = true;

  if category_code is null or length(category_code) <> 5 then
    raise check_violation using message = 'Select an active item type with a five-character category code';
  end if;

  sku_prefix := 'ARK' || category_code;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('arkline-sku:' || sku_prefix));

  select coalesce(max(right(sku_induk, 3)::integer), 0) + 1
  into next_number
  from public.arkline_dir_products
  where left(sku_induk, 8) = sku_prefix
    and sku_induk ~ '^ARK[A-Z0-9]{5}[0-9]{3}$';

  if next_number > 999 then
    raise check_violation using message = 'This category has reached the 999-SKU limit';
  end if;

  return sku_prefix || lpad(next_number::text, 3, '0');
end;
$$;

create or replace function public.set_arkline_product_sku()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sku_induk is null or btrim(new.sku_induk) = '' then
    new.sku_induk := public.generate_arkline_sku(new.category_id);
  end if;
  return new;
end;
$$;

create trigger arkline_dir_products_set_sku
before insert on public.arkline_dir_products
for each row execute function public.set_arkline_product_sku();
