alter table public.arkline_dir_materials
  add column if not exists is_qc_required boolean not null default false;
alter table public.arkline_dir_materials
  drop constraint if exists arkline_dir_materials_qc_accessories_only_check;
alter table public.arkline_dir_materials
  add constraint arkline_dir_materials_qc_accessories_only_check
  check (not is_qc_required or upper(coalesce(material_type, '')) = 'ACCESSORIES');

create table if not exists public.arkline_material_qc (
  id uuid primary key default gen_random_uuid(),
  material_po_ordered_item_id uuid not null references public.arkline_po_material_ordered_items(id) on delete cascade,
  material_po_receipt_id uuid null references public.arkline_po_material_receipts(id) on delete set null,
  material_po_number text not null,
  material_name text not null,
  material_variant text null,
  assigned_to text not null,
  allocated_qty integer not null default 0 check (allocated_qty >= 0),
  qty_a integer not null default 0 check (qty_a >= 0),
  qty_b integer not null default 0 check (qty_b >= 0),
  qty_c integer not null default 0 check (qty_c >= 0),
  locked_qty integer not null default 0 check (locked_qty >= 0),
  status text not null default 'queued' check (status in ('queued', 'in_progress', 'paused', 'done')),
  stopwatch_seconds integer not null default 0 check (stopwatch_seconds >= 0),
  pause_reason text null,
  paused_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_material_qc_result_qty_check check (qty_a + qty_b + qty_c <= allocated_qty)
);

create index if not exists arkline_material_qc_item_idx
  on public.arkline_material_qc (material_po_ordered_item_id);
create index if not exists arkline_material_qc_receipt_idx
  on public.arkline_material_qc (material_po_receipt_id);
create index if not exists arkline_material_qc_assigned_status_idx
  on public.arkline_material_qc (assigned_to, status);
create index if not exists arkline_material_qc_po_idx
  on public.arkline_material_qc (material_po_number);

drop trigger if exists arkline_material_qc_set_updated_at on public.arkline_material_qc;
create trigger arkline_material_qc_set_updated_at
before update on public.arkline_material_qc
for each row execute function public.set_updated_at();

create table if not exists public.arkline_material_qc_reject_details (
  id uuid primary key default gen_random_uuid(),
  arkline_material_qc_id uuid not null references public.arkline_material_qc(id) on delete cascade,
  material_po_ordered_item_id uuid not null references public.arkline_po_material_ordered_items(id) on delete cascade,
  material_po_number text not null,
  material_name text not null,
  grade text not null check (grade in ('B', 'C')),
  size_variant text null,
  color_variant text null,
  reject_reason_id uuid not null references public.arkline_qc_reject_reasons(id) on delete restrict,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arkline_material_qc_reject_task_idx
  on public.arkline_material_qc_reject_details (arkline_material_qc_id);
create index if not exists arkline_material_qc_reject_po_idx
  on public.arkline_material_qc_reject_details (material_po_number, material_po_ordered_item_id);

drop trigger if exists arkline_material_qc_reject_set_updated_at on public.arkline_material_qc_reject_details;
create trigger arkline_material_qc_reject_set_updated_at
before update on public.arkline_material_qc_reject_details
for each row execute function public.set_updated_at();

alter table public.arkline_material_qc enable row level security;
alter table public.arkline_material_qc_reject_details enable row level security;

drop policy if exists arkline_material_qc_authenticated_select on public.arkline_material_qc;
drop policy if exists arkline_material_qc_authenticated_insert on public.arkline_material_qc;
drop policy if exists arkline_material_qc_authenticated_update on public.arkline_material_qc;
drop policy if exists arkline_material_qc_authenticated_delete on public.arkline_material_qc;
create policy arkline_material_qc_authenticated_select on public.arkline_material_qc for select to authenticated using (true);
create policy arkline_material_qc_authenticated_insert on public.arkline_material_qc for insert to authenticated with check (true);
create policy arkline_material_qc_authenticated_update on public.arkline_material_qc for update to authenticated using (true) with check (true);
create policy arkline_material_qc_authenticated_delete on public.arkline_material_qc for delete to authenticated using (true);

drop policy if exists arkline_material_qc_reject_authenticated_select on public.arkline_material_qc_reject_details;
drop policy if exists arkline_material_qc_reject_authenticated_insert on public.arkline_material_qc_reject_details;
drop policy if exists arkline_material_qc_reject_authenticated_update on public.arkline_material_qc_reject_details;
drop policy if exists arkline_material_qc_reject_authenticated_delete on public.arkline_material_qc_reject_details;
create policy arkline_material_qc_reject_authenticated_select on public.arkline_material_qc_reject_details for select to authenticated using (true);
create policy arkline_material_qc_reject_authenticated_insert on public.arkline_material_qc_reject_details for insert to authenticated with check (true);
create policy arkline_material_qc_reject_authenticated_update on public.arkline_material_qc_reject_details for update to authenticated using (true) with check (true);
create policy arkline_material_qc_reject_authenticated_delete on public.arkline_material_qc_reject_details for delete to authenticated using (true);

grant select, insert, update, delete on public.arkline_material_qc to authenticated;
grant select, insert, update, delete on public.arkline_material_qc_reject_details to authenticated;
