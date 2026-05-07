begin;

create table if not exists public.dir_arkline_suppliers (
  id bigint generated always as identity primary key,
  supplier_code text unique,
  supplier_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dir_arkline_materials (
  id bigint generated always as identity primary key,
  material_code text not null unique,
  material_name text not null,
  unit text not null default 'PCS',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dir_arkline_bom_lines (
  id bigint generated always as identity primary key,
  sku_induk text references public.dir_arkline_products(sku_induk),
  kategori_produk text,
  material_code text not null references public.dir_arkline_materials(material_code),
  material_name text not null,
  unit text not null default 'PCS',
  size text,
  qty_per_1 numeric(18,4) not null default 0,
  waste_pct numeric(10,4) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dir_arkline_bom_lines_product_scope_check
    check (sku_induk is not null or kategori_produk is not null)
);

create table if not exists public.arkline_pos (
  id bigint generated always as identity primary key,
  po_id text not null unique,
  mode text not null default 'new',
  method text not null default 'FOB',
  supplier_id bigint,
  supplier_name_snapshot text,
  request_delivery_date date,
  updated_delivery_date date,
  completion_date date,
  status text not null default 'Draft',
  notes text,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_pos_method_check check (method in ('FOB', 'CMT')),
  constraint arkline_pos_status_check check (status in ('Draft', 'Initiated', 'On Progress', 'Completed'))
);

create table if not exists public.arkline_po_items (
  id bigint generated always as identity primary key,
  arkline_po_id bigint not null references public.arkline_pos(id) on delete cascade,
  sku_induk text not null references public.dir_arkline_products(sku_induk),
  nama_produk_snapshot text not null,
  kategori_produk_snapshot text,
  allowance_pct numeric(10,4) not null default 0,
  total_qty numeric(18,4) not null default 0,
  actual_qty numeric(18,4) not null default 0,
  status text not null default 'Initiated',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_po_items_status_check check (status in ('Initiated', 'On Progress', 'Completed')),
  constraint arkline_po_items_unique_product unique (arkline_po_id, sku_induk)
);

create table if not exists public.arkline_po_item_sizes (
  id bigint generated always as identity primary key,
  arkline_po_item_id bigint not null references public.arkline_po_items(id) on delete cascade,
  size text not null,
  qty numeric(18,4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_po_item_sizes_unique unique (arkline_po_item_id, size)
);

create table if not exists public.arkline_po_material_lines (
  id bigint generated always as identity primary key,
  arkline_po_id bigint not null references public.arkline_pos(id) on delete cascade,
  arkline_po_item_id bigint references public.arkline_po_items(id) on delete cascade,
  material_code text references public.dir_arkline_materials(material_code),
  material_name_snapshot text not null,
  size text,
  generated_qty numeric(18,4) not null default 0,
  final_qty numeric(18,4) not null default 0,
  unit text not null default 'PCS',
  source_sku_induk text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.arkline_po_history (
  id bigint generated always as identity primary key,
  arkline_po_id bigint not null references public.arkline_pos(id) on delete cascade,
  arkline_po_item_id bigint references public.arkline_po_items(id) on delete set null,
  change_type text not null,
  field_name text,
  old_value text,
  new_value text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.arkline_po_receipts (
  id bigint generated always as identity primary key,
  arkline_po_id bigint not null references public.arkline_pos(id) on delete cascade,
  arkline_po_item_id bigint references public.arkline_po_items(id) on delete set null,
  sku_induk text,
  received_date date,
  qty numeric(18,4) not null default 0,
  is_final boolean not null default false,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists public.arkline_po_payments (
  id bigint generated always as identity primary key,
  arkline_po_id bigint not null references public.arkline_pos(id) on delete cascade,
  payment_date date,
  payment_type text,
  amount numeric(18,2) not null default 0,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_arkline_pos_po_id on public.arkline_pos(po_id);
create index if not exists idx_arkline_pos_status on public.arkline_pos(status);
create index if not exists idx_arkline_pos_method on public.arkline_pos(method);
create index if not exists idx_arkline_po_items_po_id on public.arkline_po_items(arkline_po_id);
create index if not exists idx_arkline_po_item_sizes_item_id on public.arkline_po_item_sizes(arkline_po_item_id);
create index if not exists idx_arkline_po_material_lines_po_id on public.arkline_po_material_lines(arkline_po_id);
create index if not exists idx_arkline_po_material_lines_item_id on public.arkline_po_material_lines(arkline_po_item_id);
create index if not exists idx_dir_arkline_bom_lines_sku on public.dir_arkline_bom_lines(sku_induk);
create index if not exists idx_dir_arkline_bom_lines_category on public.dir_arkline_bom_lines(kategori_produk);

comment on table public.arkline_pos is
'Arkline production planning header table. One row represents one PO-level planning record.';

comment on column public.arkline_pos.po_id is
'Business-facing PO identifier used throughout Arkline planning and downstream tracking.';

comment on column public.arkline_pos.mode is
'Planning mode used when the PO was last saved. Usually new or existing.';

comment on column public.arkline_pos.method is
'Planning method: FOB means no material generation, CMT means BOM-based material generation.';

comment on table public.arkline_po_items is
'Product lines inside an Arkline PO. One row represents one product SKU planned inside one PO.';

comment on column public.arkline_po_items.allowance_pct is
'Planning allowance percentage applied during CMT material generation.';

comment on table public.arkline_po_item_sizes is
'Normalized size quantity rows for each Arkline PO item.';

comment on table public.arkline_po_material_lines is
'Generated material lines for CMT planning, derived from BOM and saved as planning output.';

comment on table public.arkline_po_history is
'Audit trail for Arkline production planning changes.';

comment on table public.dir_arkline_bom_lines is
'Arkline BOM definition used to generate material requirements from production planning.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_dir_arkline_suppliers_updated_at on public.dir_arkline_suppliers;
create trigger trg_dir_arkline_suppliers_updated_at
before update on public.dir_arkline_suppliers
for each row execute function public.set_updated_at();

drop trigger if exists trg_dir_arkline_materials_updated_at on public.dir_arkline_materials;
create trigger trg_dir_arkline_materials_updated_at
before update on public.dir_arkline_materials
for each row execute function public.set_updated_at();

drop trigger if exists trg_dir_arkline_bom_lines_updated_at on public.dir_arkline_bom_lines;
create trigger trg_dir_arkline_bom_lines_updated_at
before update on public.dir_arkline_bom_lines
for each row execute function public.set_updated_at();

drop trigger if exists trg_arkline_pos_updated_at on public.arkline_pos;
create trigger trg_arkline_pos_updated_at
before update on public.arkline_pos
for each row execute function public.set_updated_at();

drop trigger if exists trg_arkline_po_items_updated_at on public.arkline_po_items;
create trigger trg_arkline_po_items_updated_at
before update on public.arkline_po_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_arkline_po_item_sizes_updated_at on public.arkline_po_item_sizes;
create trigger trg_arkline_po_item_sizes_updated_at
before update on public.arkline_po_item_sizes
for each row execute function public.set_updated_at();

drop trigger if exists trg_arkline_po_material_lines_updated_at on public.arkline_po_material_lines;
create trigger trg_arkline_po_material_lines_updated_at
before update on public.arkline_po_material_lines
for each row execute function public.set_updated_at();

alter table public.dir_arkline_suppliers enable row level security;
alter table public.dir_arkline_materials enable row level security;
alter table public.dir_arkline_bom_lines enable row level security;
alter table public.arkline_pos enable row level security;
alter table public.arkline_po_items enable row level security;
alter table public.arkline_po_item_sizes enable row level security;
alter table public.arkline_po_material_lines enable row level security;
alter table public.arkline_po_history enable row level security;
alter table public.arkline_po_receipts enable row level security;
alter table public.arkline_po_payments enable row level security;

drop policy if exists "authenticated_select_dir_arkline_suppliers" on public.dir_arkline_suppliers;
drop policy if exists "authenticated_insert_dir_arkline_suppliers" on public.dir_arkline_suppliers;
drop policy if exists "authenticated_update_dir_arkline_suppliers" on public.dir_arkline_suppliers;
drop policy if exists "authenticated_delete_dir_arkline_suppliers" on public.dir_arkline_suppliers;
create policy "authenticated_select_dir_arkline_suppliers" on public.dir_arkline_suppliers for select to authenticated using (true);
create policy "authenticated_insert_dir_arkline_suppliers" on public.dir_arkline_suppliers for insert to authenticated with check (true);
create policy "authenticated_update_dir_arkline_suppliers" on public.dir_arkline_suppliers for update to authenticated using (true) with check (true);
create policy "authenticated_delete_dir_arkline_suppliers" on public.dir_arkline_suppliers for delete to authenticated using (true);

drop policy if exists "authenticated_select_dir_arkline_materials" on public.dir_arkline_materials;
drop policy if exists "authenticated_insert_dir_arkline_materials" on public.dir_arkline_materials;
drop policy if exists "authenticated_update_dir_arkline_materials" on public.dir_arkline_materials;
drop policy if exists "authenticated_delete_dir_arkline_materials" on public.dir_arkline_materials;
create policy "authenticated_select_dir_arkline_materials" on public.dir_arkline_materials for select to authenticated using (true);
create policy "authenticated_insert_dir_arkline_materials" on public.dir_arkline_materials for insert to authenticated with check (true);
create policy "authenticated_update_dir_arkline_materials" on public.dir_arkline_materials for update to authenticated using (true) with check (true);
create policy "authenticated_delete_dir_arkline_materials" on public.dir_arkline_materials for delete to authenticated using (true);

drop policy if exists "authenticated_select_dir_arkline_bom_lines" on public.dir_arkline_bom_lines;
drop policy if exists "authenticated_insert_dir_arkline_bom_lines" on public.dir_arkline_bom_lines;
drop policy if exists "authenticated_update_dir_arkline_bom_lines" on public.dir_arkline_bom_lines;
drop policy if exists "authenticated_delete_dir_arkline_bom_lines" on public.dir_arkline_bom_lines;
create policy "authenticated_select_dir_arkline_bom_lines" on public.dir_arkline_bom_lines for select to authenticated using (true);
create policy "authenticated_insert_dir_arkline_bom_lines" on public.dir_arkline_bom_lines for insert to authenticated with check (true);
create policy "authenticated_update_dir_arkline_bom_lines" on public.dir_arkline_bom_lines for update to authenticated using (true) with check (true);
create policy "authenticated_delete_dir_arkline_bom_lines" on public.dir_arkline_bom_lines for delete to authenticated using (true);

drop policy if exists "authenticated_select_arkline_pos" on public.arkline_pos;
drop policy if exists "authenticated_insert_arkline_pos" on public.arkline_pos;
drop policy if exists "authenticated_update_arkline_pos" on public.arkline_pos;
drop policy if exists "authenticated_delete_arkline_pos" on public.arkline_pos;
create policy "authenticated_select_arkline_pos" on public.arkline_pos for select to authenticated using (true);
create policy "authenticated_insert_arkline_pos" on public.arkline_pos for insert to authenticated with check (true);
create policy "authenticated_update_arkline_pos" on public.arkline_pos for update to authenticated using (true) with check (true);
create policy "authenticated_delete_arkline_pos" on public.arkline_pos for delete to authenticated using (true);

drop policy if exists "authenticated_select_arkline_po_items" on public.arkline_po_items;
drop policy if exists "authenticated_insert_arkline_po_items" on public.arkline_po_items;
drop policy if exists "authenticated_update_arkline_po_items" on public.arkline_po_items;
drop policy if exists "authenticated_delete_arkline_po_items" on public.arkline_po_items;
create policy "authenticated_select_arkline_po_items" on public.arkline_po_items for select to authenticated using (true);
create policy "authenticated_insert_arkline_po_items" on public.arkline_po_items for insert to authenticated with check (true);
create policy "authenticated_update_arkline_po_items" on public.arkline_po_items for update to authenticated using (true) with check (true);
create policy "authenticated_delete_arkline_po_items" on public.arkline_po_items for delete to authenticated using (true);

drop policy if exists "authenticated_select_arkline_po_item_sizes" on public.arkline_po_item_sizes;
drop policy if exists "authenticated_insert_arkline_po_item_sizes" on public.arkline_po_item_sizes;
drop policy if exists "authenticated_update_arkline_po_item_sizes" on public.arkline_po_item_sizes;
drop policy if exists "authenticated_delete_arkline_po_item_sizes" on public.arkline_po_item_sizes;
create policy "authenticated_select_arkline_po_item_sizes" on public.arkline_po_item_sizes for select to authenticated using (true);
create policy "authenticated_insert_arkline_po_item_sizes" on public.arkline_po_item_sizes for insert to authenticated with check (true);
create policy "authenticated_update_arkline_po_item_sizes" on public.arkline_po_item_sizes for update to authenticated using (true) with check (true);
create policy "authenticated_delete_arkline_po_item_sizes" on public.arkline_po_item_sizes for delete to authenticated using (true);

drop policy if exists "authenticated_select_arkline_po_material_lines" on public.arkline_po_material_lines;
drop policy if exists "authenticated_insert_arkline_po_material_lines" on public.arkline_po_material_lines;
drop policy if exists "authenticated_update_arkline_po_material_lines" on public.arkline_po_material_lines;
drop policy if exists "authenticated_delete_arkline_po_material_lines" on public.arkline_po_material_lines;
create policy "authenticated_select_arkline_po_material_lines" on public.arkline_po_material_lines for select to authenticated using (true);
create policy "authenticated_insert_arkline_po_material_lines" on public.arkline_po_material_lines for insert to authenticated with check (true);
create policy "authenticated_update_arkline_po_material_lines" on public.arkline_po_material_lines for update to authenticated using (true) with check (true);
create policy "authenticated_delete_arkline_po_material_lines" on public.arkline_po_material_lines for delete to authenticated using (true);

drop policy if exists "authenticated_select_arkline_po_history" on public.arkline_po_history;
drop policy if exists "authenticated_insert_arkline_po_history" on public.arkline_po_history;
create policy "authenticated_select_arkline_po_history" on public.arkline_po_history for select to authenticated using (true);
create policy "authenticated_insert_arkline_po_history" on public.arkline_po_history for insert to authenticated with check (true);

drop policy if exists "authenticated_select_arkline_po_receipts" on public.arkline_po_receipts;
drop policy if exists "authenticated_insert_arkline_po_receipts" on public.arkline_po_receipts;
drop policy if exists "authenticated_update_arkline_po_receipts" on public.arkline_po_receipts;
drop policy if exists "authenticated_delete_arkline_po_receipts" on public.arkline_po_receipts;
create policy "authenticated_select_arkline_po_receipts" on public.arkline_po_receipts for select to authenticated using (true);
create policy "authenticated_insert_arkline_po_receipts" on public.arkline_po_receipts for insert to authenticated with check (true);
create policy "authenticated_update_arkline_po_receipts" on public.arkline_po_receipts for update to authenticated using (true) with check (true);
create policy "authenticated_delete_arkline_po_receipts" on public.arkline_po_receipts for delete to authenticated using (true);

drop policy if exists "authenticated_select_arkline_po_payments" on public.arkline_po_payments;
drop policy if exists "authenticated_insert_arkline_po_payments" on public.arkline_po_payments;
drop policy if exists "authenticated_update_arkline_po_payments" on public.arkline_po_payments;
drop policy if exists "authenticated_delete_arkline_po_payments" on public.arkline_po_payments;
create policy "authenticated_select_arkline_po_payments" on public.arkline_po_payments for select to authenticated using (true);
create policy "authenticated_insert_arkline_po_payments" on public.arkline_po_payments for insert to authenticated with check (true);
create policy "authenticated_update_arkline_po_payments" on public.arkline_po_payments for update to authenticated using (true) with check (true);
create policy "authenticated_delete_arkline_po_payments" on public.arkline_po_payments for delete to authenticated using (true);

commit;
