create extension if not exists pgcrypto;

create table if not exists public.arkline_po_item_sizes (
  id uuid primary key default gen_random_uuid(),
  arkline_po_item_id uuid not null references public.arkline_po_items(id) on update cascade on delete cascade,
  size text not null,
  qty integer not null default 0 check (qty >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_po_item_sizes_item_size_unique unique (arkline_po_item_id, size)
);

create index if not exists arkline_po_item_sizes_item_idx
  on public.arkline_po_item_sizes (arkline_po_item_id);

create or replace function public.set_arkline_po_item_sizes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_po_item_sizes_set_updated_at on public.arkline_po_item_sizes;
create trigger arkline_po_item_sizes_set_updated_at
before update on public.arkline_po_item_sizes
for each row
execute function public.set_arkline_po_item_sizes_updated_at();

alter table public.arkline_po_item_sizes enable row level security;

drop policy if exists arkline_po_item_sizes_authenticated_select on public.arkline_po_item_sizes;
drop policy if exists arkline_po_item_sizes_authenticated_insert on public.arkline_po_item_sizes;
drop policy if exists arkline_po_item_sizes_authenticated_update on public.arkline_po_item_sizes;
drop policy if exists arkline_po_item_sizes_authenticated_delete on public.arkline_po_item_sizes;

create policy arkline_po_item_sizes_authenticated_select
on public.arkline_po_item_sizes
for select
to authenticated
using (true);

create policy arkline_po_item_sizes_authenticated_insert
on public.arkline_po_item_sizes
for insert
to authenticated
with check (true);

create policy arkline_po_item_sizes_authenticated_update
on public.arkline_po_item_sizes
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_item_sizes_authenticated_delete
on public.arkline_po_item_sizes
for delete
to authenticated
using (true);
