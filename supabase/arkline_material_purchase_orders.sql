create extension if not exists pgcrypto;

create table if not exists public.arkline_po_material_ordered (
  id uuid primary key default gen_random_uuid(),
  material_po_number text not null unique,
  supplier_id bigint null,
  supplier_name_snapshot text null,
  garment_po_number text null,
  source_type text not null default 'FREE',
  request_delivery_date date null,
  payment_terms text null,
  notes text null,
  status text not null default 'ORDERED',
  created_by text null,
  updated_by text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.arkline_po_material_ordered_items (
  id uuid primary key default gen_random_uuid(),
  material_po_ordered_id uuid not null references public.arkline_po_material_ordered(id) on delete cascade,
  material_po_number text not null,
  material_id uuid null,
  material_name_snapshot text null,
  size_variant text null,
  color_variant text null,
  unit text null,
  qty numeric not null default 0,
  price numeric not null default 0,
  amount numeric not null default 0,
  notes text null,
  source_type text not null default 'FREE',
  source_po_id text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists arkline_po_material_ordered_items_po_number_idx
  on public.arkline_po_material_ordered_items(material_po_number);

create index if not exists arkline_po_material_ordered_items_material_po_ordered_id_idx
  on public.arkline_po_material_ordered_items(material_po_ordered_id);

alter table public.arkline_po_material_logs
  add column if not exists material_po_number text null,
  add column if not exists material_po_ordered_id uuid null references public.arkline_po_material_ordered(id) on delete set null,
  add column if not exists material_po_ordered_item_id uuid null references public.arkline_po_material_ordered_items(id) on delete set null,
  add column if not exists material_id uuid null,
  add column if not exists material_name_snapshot text null,
  add column if not exists size_variant text null,
  add column if not exists color_variant text null,
  add column if not exists unit text null;

create index if not exists arkline_po_material_logs_material_po_number_idx
  on public.arkline_po_material_logs(material_po_number);

create index if not exists arkline_po_material_logs_material_po_ordered_id_idx
  on public.arkline_po_material_logs(material_po_ordered_id);
