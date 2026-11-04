alter table public.arkline_dir_products
  add constraint arkline_dir_products_sku_format_check
  check (sku_induk ~ '^ARK[A-Z0-9]{5}[0-9]{3}$');

create or replace function public.validate_arkline_product_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  expected_code text;
begin
  select upper(full_code) into expected_code
  from public.dir_categories
  where id = new.category_id;

  if expected_code is null or substring(upper(new.sku_induk) from 4 for 5) is distinct from expected_code then
    raise check_violation using message = 'Arkline SKU category code must match dir_categories.full_code';
  end if;

  return new;
end;
$$;

create trigger arkline_dir_products_validate_category
before insert or update of sku_induk, category_id
on public.arkline_dir_products
for each row execute function public.validate_arkline_product_category();
