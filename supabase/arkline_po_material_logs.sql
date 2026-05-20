create extension if not exists pgcrypto;

create table if not exists public.arkline_po_material_logs (
  id uuid primary key default gen_random_uuid(),
  arkline_po_material_id uuid not null references public.arkline_po_materials(id) on update cascade on delete cascade,
  po_id text not null,
  arkline_po_item_id uuid not null references public.arkline_po_items(id) on update cascade on delete cascade,
  log_type text not null check (log_type in ('ordered', 'received', 'sent_to_garment')),
  qty numeric(14,2) not null default 0 check (qty >= 0),
  event_date date not null,
  supplier_name text null,
  notes text null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists arkline_po_material_logs_material_idx
  on public.arkline_po_material_logs (arkline_po_material_id);

create index if not exists arkline_po_material_logs_po_id_idx
  on public.arkline_po_material_logs (po_id);

create index if not exists arkline_po_material_logs_po_item_idx
  on public.arkline_po_material_logs (arkline_po_item_id);

create index if not exists arkline_po_material_logs_type_date_idx
  on public.arkline_po_material_logs (log_type, event_date desc);

create or replace function public.set_arkline_po_material_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_po_material_logs_set_updated_at on public.arkline_po_material_logs;
create trigger arkline_po_material_logs_set_updated_at
before update on public.arkline_po_material_logs
for each row
execute function public.set_arkline_po_material_logs_updated_at();

alter table public.arkline_po_material_logs enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.arkline_po_material_logs to authenticated;

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
