alter table public.arkline_po_material_ordered
  add column if not exists updated_delivery_date date;

create table if not exists public.arkline_po_material_receipts (
  id uuid primary key default gen_random_uuid(),
  material_po_ordered_item_id uuid not null references public.arkline_po_material_ordered_items(id) on delete cascade,
  received_qty numeric(14,4) not null check (received_qty > 0),
  receive_date date not null,
  supplier_sj text,
  notes text,
  is_final boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists arkline_po_material_receipts_item_date_idx
  on public.arkline_po_material_receipts (material_po_ordered_item_id, receive_date desc);

alter table public.arkline_po_material_receipts enable row level security;

create policy arkline_po_material_receipts_authenticated_select
  on public.arkline_po_material_receipts for select to authenticated using (true);
create policy arkline_po_material_receipts_authenticated_insert
  on public.arkline_po_material_receipts for insert to authenticated with check (true);

grant select, insert on public.arkline_po_material_receipts to authenticated;

create table if not exists public.arkline_po_material_delivery_updates (
  id uuid primary key default gen_random_uuid(),
  material_po_ordered_id uuid not null references public.arkline_po_material_ordered(id) on delete cascade,
  previous_updated_delivery_date date,
  updated_delivery_date date not null,
  reason text not null,
  notes text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists arkline_po_material_delivery_updates_po_date_idx
  on public.arkline_po_material_delivery_updates (material_po_ordered_id, created_at desc);

alter table public.arkline_po_material_delivery_updates enable row level security;

create policy arkline_po_material_delivery_updates_authenticated_select
  on public.arkline_po_material_delivery_updates for select to authenticated using (true);
create policy arkline_po_material_delivery_updates_authenticated_insert
  on public.arkline_po_material_delivery_updates for insert to authenticated with check (true);

grant select, insert on public.arkline_po_material_delivery_updates to authenticated;
