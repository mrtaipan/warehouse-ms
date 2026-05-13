create extension if not exists pgcrypto;

drop table if exists public.arkline_po_items cascade;

create table public.arkline_po_items (
  id uuid primary key default gen_random_uuid(),
  po_id text not null,
  sku_induk text not null,
  nama_produk text not null,
  kategori_produk text null,
  allowance_pct smallint not null default 0,
  total_qty integer not null default 0,
  actual_qty integer not null default 0,
  notes text null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completion_date date null,
  updated_delivery_date date null,
  kategori_pengadaan text null,
  hpp numeric(14,2) null,
  constraint arkline_po_items_po_id_fkey
    foreign key (po_id)
    references public.arkline_pos (po_id)
    on update cascade
    on delete cascade
);

create index if not exists arkline_po_items_po_id_idx
  on public.arkline_po_items (po_id);

create index if not exists arkline_po_items_po_id_sku_induk_idx
  on public.arkline_po_items (po_id, sku_induk);

create or replace function public.set_arkline_po_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger arkline_po_items_set_updated_at
before update on public.arkline_po_items
for each row
execute function public.set_arkline_po_items_updated_at();

alter table public.arkline_po_items enable row level security;

create policy arkline_po_items_authenticated_select
on public.arkline_po_items
for select
to authenticated
using (true);

create policy arkline_po_items_authenticated_insert
on public.arkline_po_items
for insert
to authenticated
with check (true);

create policy arkline_po_items_authenticated_update
on public.arkline_po_items
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_items_authenticated_delete
on public.arkline_po_items
for delete
to authenticated
using (true);
