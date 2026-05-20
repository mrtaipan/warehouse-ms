create extension if not exists pgcrypto;

create table if not exists public.arkline_po_item_receipts (
  id uuid primary key default gen_random_uuid(),
  arkline_po_item_id uuid not null,
  po_id text not null,
  sku_induk text not null,
  receipt_group_id uuid null,
  size text not null,
  received_qty integer not null check (received_qty > 0),
  receive_date date not null,
  is_final boolean not null default false,
  notes text null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_po_item_receipts_po_item_id_fkey
    foreign key (arkline_po_item_id)
    references public.arkline_po_items (id)
    on delete cascade
);

alter table if exists public.arkline_po_item_receipts
  drop constraint if exists arkline_po_item_receipts_po_id_fkey;

alter table if exists public.arkline_po_item_receipts
  add column if not exists receipt_group_id uuid null;

alter table if exists public.arkline_po_item_receipts
  add column if not exists is_final boolean not null default false;

alter table if exists public.arkline_po_item_receipts
  add column if not exists created_by text null;

create index if not exists arkline_po_item_receipts_po_item_id_idx
  on public.arkline_po_item_receipts (arkline_po_item_id);

create index if not exists arkline_po_item_receipts_po_id_idx
  on public.arkline_po_item_receipts (po_id);

create index if not exists arkline_po_item_receipts_group_idx
  on public.arkline_po_item_receipts (receipt_group_id);

create index if not exists arkline_po_item_receipts_po_item_size_date_idx
  on public.arkline_po_item_receipts (arkline_po_item_id, size, receive_date);

create or replace function public.set_arkline_po_item_receipts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_po_item_receipts_set_updated_at on public.arkline_po_item_receipts;

create trigger arkline_po_item_receipts_set_updated_at
before update on public.arkline_po_item_receipts
for each row
execute function public.set_arkline_po_item_receipts_updated_at();

create or replace function public.sync_arkline_po_item_receipt_summary()
returns trigger
language plpgsql
as $$
declare
  target_item_id uuid;
begin
  target_item_id = coalesce(new.arkline_po_item_id, old.arkline_po_item_id);

  update public.arkline_po_items item
  set
    actual_qty = coalesce(summary.total_received_qty, 0),
    completion_date = case
      when coalesce(summary.total_received_qty, 0) >= coalesce(item.total_qty, 0)
        then summary.last_receive_date
      else null
    end
  from (
    select
      arkline_po_item_id,
      coalesce(sum(received_qty), 0) as total_received_qty,
      max(receive_date) as last_receive_date
    from public.arkline_po_item_receipts
    where arkline_po_item_id = target_item_id
    group by arkline_po_item_id
  ) as summary
  where item.id = summary.arkline_po_item_id;

  update public.arkline_po_items
  set
    actual_qty = 0,
    completion_date = null
  where id = target_item_id
    and not exists (
      select 1
      from public.arkline_po_item_receipts
      where arkline_po_item_id = target_item_id
    );

  return coalesce(new, old);
end;
$$;

drop trigger if exists arkline_po_item_receipts_sync_summary on public.arkline_po_item_receipts;

create trigger arkline_po_item_receipts_sync_summary
after insert or update or delete on public.arkline_po_item_receipts
for each row
execute function public.sync_arkline_po_item_receipt_summary();

alter table public.arkline_po_item_receipts enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.arkline_po_item_receipts to authenticated;

drop policy if exists arkline_po_item_receipts_authenticated_select on public.arkline_po_item_receipts;
drop policy if exists arkline_po_item_receipts_authenticated_insert on public.arkline_po_item_receipts;
drop policy if exists arkline_po_item_receipts_authenticated_update on public.arkline_po_item_receipts;
drop policy if exists arkline_po_item_receipts_authenticated_delete on public.arkline_po_item_receipts;

create policy arkline_po_item_receipts_authenticated_select
on public.arkline_po_item_receipts
for select
to authenticated
using (true);

create policy arkline_po_item_receipts_authenticated_insert
on public.arkline_po_item_receipts
for insert
to authenticated
with check (true);

create policy arkline_po_item_receipts_authenticated_update
on public.arkline_po_item_receipts
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_item_receipts_authenticated_delete
on public.arkline_po_item_receipts
for delete
to authenticated
using (true);
