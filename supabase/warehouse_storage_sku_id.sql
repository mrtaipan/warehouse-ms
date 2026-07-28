alter table public.warehouse_storage
  add column if not exists sku_id text null;

alter table public.warehouse_storage
  drop constraint if exists warehouse_storage_sku_id_fkey;

alter table public.warehouse_storage
  alter column sku_id type text using sku_id::text;

create index if not exists warehouse_storage_sku_id_idx
  on public.warehouse_storage (sku_id);
