-- Derive warehouse storage brand and category identity from the SKU prefix.
-- SKU format: BBBCCCCC..., where BBB is dir_brands.brand_code and
-- CCCCC is dir_categories.full_code.

alter table public.warehouse_storage
  add column if not exists brand_code text null,
  add column if not exists category_id bigint null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'warehouse_storage_category_id_fkey'
      and conrelid = 'public.warehouse_storage'::regclass
  ) then
    alter table public.warehouse_storage
      add constraint warehouse_storage_category_id_fkey
      foreign key (category_id)
      references public.dir_categories(id)
      on update cascade
      on delete set null;
  end if;
end $$;

create index if not exists warehouse_storage_brand_code_idx
  on public.warehouse_storage (brand_code);

create index if not exists warehouse_storage_category_id_idx
  on public.warehouse_storage (category_id);

create or replace function public.set_warehouse_storage_sku_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sku_token text;
  matched_brand_code text;
  matched_category_id bigint;
begin
  sku_token := upper(regexp_replace(coalesce(new.sku_id, ''), '[^A-Z0-9]', '', 'g'));

  if length(sku_token) < 8 then
    return new;
  end if;

  select upper(trim(brand.brand_code))
    into matched_brand_code
  from public.dir_brands brand
  where upper(trim(coalesce(brand.brand_code, ''))) = left(sku_token, 3)
    and coalesce(brand.is_active, true)
  order by brand.id
  limit 1;

  select category.id
    into matched_category_id
  from public.dir_categories category
  where upper(regexp_replace(coalesce(category.full_code, ''), '[^A-Z0-9]', '', 'g')) = substring(sku_token from 4 for 5)
    and coalesce(category.is_active, true)
  order by category.id
  limit 1;

  if nullif(trim(coalesce(new.brand_code, '')), '') is null and matched_brand_code is not null then
    new.brand_code := matched_brand_code;
  end if;

  if new.category_id is null and matched_category_id is not null then
    new.category_id := matched_category_id;
  end if;

  return new;
end;
$$;

drop trigger if exists warehouse_storage_sku_identity_trigger
  on public.warehouse_storage;

create trigger warehouse_storage_sku_identity_trigger
before insert or update of sku_id on public.warehouse_storage
for each row
execute function public.set_warehouse_storage_sku_identity();

update public.warehouse_storage storage
set brand_code = upper(trim(brand.brand_code))
from public.dir_brands brand
where nullif(trim(coalesce(storage.brand_code, '')), '') is null
  and upper(trim(coalesce(brand.brand_code, ''))) = left(
    upper(regexp_replace(coalesce(storage.sku_id, ''), '[^A-Z0-9]', '', 'g')),
    3
  )
  and coalesce(brand.is_active, true);

update public.warehouse_storage storage
set category_id = category.id
from public.dir_categories category
where storage.category_id is null
  and upper(regexp_replace(coalesce(category.full_code, ''), '[^A-Z0-9]', '', 'g')) = substring(
    upper(regexp_replace(coalesce(storage.sku_id, ''), '[^A-Z0-9]', '', 'g'))
    from 4 for 5
  )
  and coalesce(category.is_active, true);

comment on column public.warehouse_storage.brand_code is
  'Brand code derived from the first three alphanumeric SKU characters.';

comment on column public.warehouse_storage.category_id is
  'Product category, automatically derived from SKU characters four through eight when available.';
