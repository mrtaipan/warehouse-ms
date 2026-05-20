create extension if not exists pgcrypto;

create table if not exists public.arkline_po_item_updates (
  id uuid primary key default gen_random_uuid(),
  arkline_po_item_id uuid not null references public.arkline_po_items (id) on update cascade on delete cascade,
  po_id text not null,
  sku_induk text not null,
  previous_updated_delivery_date date null,
  updated_delivery_date date null,
  reason text not null,
  notes text null,
  impact_days integer not null default 0,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists public.arkline_po_item_updates
  drop column if exists arkline_po_id;

alter table if exists public.arkline_po_item_updates
  drop column if exists status;

alter table if exists public.arkline_po_item_updates
  drop column if exists previous_status;

create index if not exists arkline_po_item_updates_po_item_idx
  on public.arkline_po_item_updates (arkline_po_item_id);

create index if not exists arkline_po_item_updates_po_sku_idx
  on public.arkline_po_item_updates (po_id, sku_induk);

create index if not exists arkline_po_item_updates_created_at_idx
  on public.arkline_po_item_updates (created_at desc);

create or replace function public.set_arkline_po_item_updates_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_po_item_updates_set_updated_at on public.arkline_po_item_updates;

create trigger arkline_po_item_updates_set_updated_at
before update on public.arkline_po_item_updates
for each row
execute function public.set_arkline_po_item_updates_updated_at();

alter table public.arkline_po_item_updates enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.arkline_po_item_updates to authenticated;

drop policy if exists arkline_po_item_updates_authenticated_select on public.arkline_po_item_updates;
drop policy if exists arkline_po_item_updates_authenticated_insert on public.arkline_po_item_updates;
drop policy if exists arkline_po_item_updates_authenticated_update on public.arkline_po_item_updates;
drop policy if exists arkline_po_item_updates_authenticated_delete on public.arkline_po_item_updates;

create policy arkline_po_item_updates_authenticated_select
on public.arkline_po_item_updates
for select
to authenticated
using (true);

create policy arkline_po_item_updates_authenticated_insert
on public.arkline_po_item_updates
for insert
to authenticated
with check (true);

create policy arkline_po_item_updates_authenticated_update
on public.arkline_po_item_updates
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_item_updates_authenticated_delete
on public.arkline_po_item_updates
for delete
to authenticated
using (true);
