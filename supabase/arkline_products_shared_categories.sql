begin;

update public.dir_categories
set category_code = 'HTA', full_code = '03HTA'
where id = 13 and category_name = 'HAT' and full_code = '03HAT';

alter table public.arkline_dir_products
  add column category_id bigint;

update public.arkline_dir_products product
set category_id = category.id
from public.dir_categories category
where upper(category.full_code) = substring(upper(product.sku_induk) from 4 for 5);

do $$
begin
  if exists (select 1 from public.arkline_dir_products where category_id is null) then
    raise exception 'Some Arkline SKUs do not match dir_categories.full_code';
  end if;
end;
$$;

alter table public.arkline_dir_products
  alter column category_id set not null,
  add constraint arkline_dir_products_category_id_fkey
    foreign key (category_id) references public.dir_categories(id)
    on update cascade on delete restrict;

create index arkline_dir_products_category_id_idx
  on public.arkline_dir_products (category_id);

drop table public.arkline_dir_product_categories;

commit;
