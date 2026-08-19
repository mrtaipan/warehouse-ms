create extension if not exists pgcrypto;

create table if not exists public.arkline_po_material_ordered (
  id uuid primary key default gen_random_uuid(),
  material_po_number text not null unique,
  supplier_id bigint null,
  supplier_name_snapshot text null,
  garment_po_number text null,
  request_delivery_date date null,
  payment_terms text null,
  notes text null,
  status text not null default 'ORDERED',
  constraint arkline_material_pos_status_check
    check (status in ('ORDERED', 'SENT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED', 'CLOSED')),
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

alter table public.arkline_po_material_ordered
  alter column status set default 'ORDERED';

alter table public.arkline_po_material_ordered
  drop constraint if exists arkline_material_pos_status_check;

alter table public.arkline_po_material_ordered
  add constraint arkline_material_pos_status_check
  check (status in ('ORDERED', 'SENT', 'RECEIVED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED', 'CLOSED'))
  not valid;

alter table public.arkline_po_material_logs
  add column if not exists material_po_number text null,
  add column if not exists material_po_ordered_id uuid null references public.arkline_po_material_ordered(id) on delete set null,
  add column if not exists material_po_ordered_item_id uuid null references public.arkline_po_material_ordered_items(id) on delete set null,
  add column if not exists material_id uuid null,
  add column if not exists material_name_snapshot text null,
  add column if not exists size_variant text null,
  add column if not exists color_variant text null,
  add column if not exists unit text null;

alter table public.arkline_po_material_logs
  alter column arkline_po_material_id drop not null,
  alter column arkline_po_item_id drop not null;

do $$
declare
  target_constraint record;
begin
  for target_constraint in
    select constraint_name
    from information_schema.check_constraints
    where constraint_schema = 'public'
      and check_clause ilike '%log_type%'
      and constraint_name in (
        select conname
        from pg_constraint
        where conrelid = 'public.arkline_po_material_logs'::regclass
          and contype = 'c'
      )
  loop
    execute format(
      'alter table public.arkline_po_material_logs drop constraint if exists %I',
      target_constraint.constraint_name
    );
  end loop;
end $$;

alter table public.arkline_po_material_logs
  add constraint arkline_po_material_logs_log_type_check
  check (log_type in ('ORDERED', 'RECEIVED', 'SENT', 'ordered', 'received', 'sent_to_garment', 'SENT_TO_GARMENT'))
  not valid;

create index if not exists arkline_po_material_logs_material_po_number_idx
  on public.arkline_po_material_logs(material_po_number);

create index if not exists arkline_po_material_logs_material_po_ordered_id_idx
  on public.arkline_po_material_logs(material_po_ordered_id);

alter table public.arkline_po_material_ordered enable row level security;
alter table public.arkline_po_material_ordered_items enable row level security;
alter table public.arkline_po_material_logs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.arkline_po_material_ordered to authenticated;
grant select, insert, update, delete on public.arkline_po_material_ordered_items to authenticated;
grant select, insert, update, delete on public.arkline_po_material_logs to authenticated;

drop policy if exists arkline_po_material_ordered_authenticated_select on public.arkline_po_material_ordered;
drop policy if exists arkline_po_material_ordered_authenticated_insert on public.arkline_po_material_ordered;
drop policy if exists arkline_po_material_ordered_authenticated_update on public.arkline_po_material_ordered;
drop policy if exists arkline_po_material_ordered_authenticated_delete on public.arkline_po_material_ordered;

create policy arkline_po_material_ordered_authenticated_select
on public.arkline_po_material_ordered
for select
to authenticated
using (true);

create policy arkline_po_material_ordered_authenticated_insert
on public.arkline_po_material_ordered
for insert
to authenticated
with check (true);

create policy arkline_po_material_ordered_authenticated_update
on public.arkline_po_material_ordered
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_material_ordered_authenticated_delete
on public.arkline_po_material_ordered
for delete
to authenticated
using (true);

drop policy if exists arkline_po_material_ordered_items_authenticated_select on public.arkline_po_material_ordered_items;
drop policy if exists arkline_po_material_ordered_items_authenticated_insert on public.arkline_po_material_ordered_items;
drop policy if exists arkline_po_material_ordered_items_authenticated_update on public.arkline_po_material_ordered_items;
drop policy if exists arkline_po_material_ordered_items_authenticated_delete on public.arkline_po_material_ordered_items;

create policy arkline_po_material_ordered_items_authenticated_select
on public.arkline_po_material_ordered_items
for select
to authenticated
using (true);

create policy arkline_po_material_ordered_items_authenticated_insert
on public.arkline_po_material_ordered_items
for insert
to authenticated
with check (true);

create policy arkline_po_material_ordered_items_authenticated_update
on public.arkline_po_material_ordered_items
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_material_ordered_items_authenticated_delete
on public.arkline_po_material_ordered_items
for delete
to authenticated
using (true);

drop policy if exists arkline_po_material_logs_authenticated_select on public.arkline_po_material_logs;
drop policy if exists arkline_po_material_logs_authenticated_insert on public.arkline_po_material_logs;
drop policy if exists arkline_po_material_logs_authenticated_update on public.arkline_po_material_logs;
drop policy if exists arkline_po_material_logs_authenticated_delete on public.arkline_po_material_logs;

create policy arkline_po_material_logs_authenticated_select
on public.arkline_po_material_logs
for select
to authenticated
using (true);

create policy arkline_po_material_logs_authenticated_insert
on public.arkline_po_material_logs
for insert
to authenticated
with check (true);

create policy arkline_po_material_logs_authenticated_update
on public.arkline_po_material_logs
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_material_logs_authenticated_delete
on public.arkline_po_material_logs
for delete
to authenticated
using (true);
