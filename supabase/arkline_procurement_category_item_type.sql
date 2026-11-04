begin;

alter table public.arkline_dir_procurement_categories
  add column category_id bigint;

do $$
begin
  if exists (
    select 1
    from public.arkline_dir_procurement_categories category
    left join public.arkline_dir_products product
      on upper(btrim(product.kategori_pengadaan)) = category.category_name
    group by category.id
    having count(distinct product.category_id) <> 1
  ) then
    raise exception 'Each existing procurement category must map to exactly one item type';
  end if;
end;
$$;

update public.arkline_dir_procurement_categories category
set category_id = source.category_id
from (
  select upper(btrim(kategori_pengadaan)) as category_name, min(category_id) as category_id
  from public.arkline_dir_products
  group by upper(btrim(kategori_pengadaan))
) source
where category.category_name = source.category_name;

alter table public.arkline_dir_procurement_categories
  alter column category_id set not null,
  add constraint arkline_dir_procurement_categories_category_id_fkey
    foreign key (category_id) references public.dir_categories(id)
    on update cascade on delete restrict;

create index arkline_dir_procurement_categories_category_id_idx
  on public.arkline_dir_procurement_categories (category_id);

commit;
