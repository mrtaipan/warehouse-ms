create table if not exists public.arkline_dir_product_categories (
  id uuid primary key default gen_random_uuid(),
  category_name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint arkline_dir_product_categories_name_check
    check (category_name = upper(btrim(category_name)) and category_name <> '')
);

create table if not exists public.arkline_dir_procurement_categories (
  id uuid primary key default gen_random_uuid(),
  category_name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint arkline_dir_procurement_categories_name_check
    check (category_name = upper(btrim(category_name)) and category_name <> '')
);

insert into public.arkline_dir_product_categories (category_name)
select distinct upper(btrim(kategori_produk))
from public.arkline_dir_products
where nullif(btrim(kategori_produk), '') is not null
on conflict (category_name) do nothing;

insert into public.arkline_dir_procurement_categories (category_name)
select distinct category_name
from (
  select upper(btrim(kategori_pengadaan)) as category_name
  from public.arkline_dir_products
  where nullif(btrim(kategori_pengadaan), '') is not null
  union
  select upper(btrim(kategori_pengadaan))
  from public.arkline_dir_bom
  where nullif(btrim(kategori_pengadaan), '') is not null
) existing_categories
on conflict (category_name) do nothing;

alter table public.arkline_dir_product_categories enable row level security;
alter table public.arkline_dir_procurement_categories enable row level security;

grant select, insert, update on public.arkline_dir_product_categories to authenticated;
grant select, insert, update on public.arkline_dir_procurement_categories to authenticated;

create policy arkline_dir_product_categories_authenticated_select
  on public.arkline_dir_product_categories for select to authenticated using (true);
create policy arkline_dir_product_categories_authenticated_insert
  on public.arkline_dir_product_categories for insert to authenticated with check (true);
create policy arkline_dir_product_categories_authenticated_update
  on public.arkline_dir_product_categories for update to authenticated using (true) with check (true);

create policy arkline_dir_procurement_categories_authenticated_select
  on public.arkline_dir_procurement_categories for select to authenticated using (true);
create policy arkline_dir_procurement_categories_authenticated_insert
  on public.arkline_dir_procurement_categories for insert to authenticated with check (true);
create policy arkline_dir_procurement_categories_authenticated_update
  on public.arkline_dir_procurement_categories for update to authenticated using (true) with check (true);
