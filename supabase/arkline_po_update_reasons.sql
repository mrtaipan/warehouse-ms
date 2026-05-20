create extension if not exists pgcrypto;

create table if not exists public.arkline_po_update_reasons (
  id uuid primary key default gen_random_uuid(),
  reason_name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_po_update_reasons_name_unique unique (reason_name)
);

insert into public.arkline_po_update_reasons (reason_name, sort_order)
values
  ('FABRIC ISSUE', 1),
  ('PRINTING ISSUE', 2),
  ('INTERNAL REVIEW & REVISION', 3),
  ('GARMENT QUALITY ISSUE', 4),
  ('SUPPLIER ISSUE', 5),
  ('OTHERS', 999)
on conflict (reason_name) do update
set
  sort_order = excluded.sort_order,
  is_active = true;

create index if not exists arkline_po_update_reasons_active_sort_idx
  on public.arkline_po_update_reasons (is_active, sort_order, reason_name);

create or replace function public.set_arkline_po_update_reasons_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_po_update_reasons_set_updated_at on public.arkline_po_update_reasons;

create trigger arkline_po_update_reasons_set_updated_at
before update on public.arkline_po_update_reasons
for each row
execute function public.set_arkline_po_update_reasons_updated_at();

alter table public.arkline_po_update_reasons enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.arkline_po_update_reasons to authenticated;

drop policy if exists arkline_po_update_reasons_authenticated_select on public.arkline_po_update_reasons;
drop policy if exists arkline_po_update_reasons_authenticated_insert on public.arkline_po_update_reasons;
drop policy if exists arkline_po_update_reasons_authenticated_update on public.arkline_po_update_reasons;
drop policy if exists arkline_po_update_reasons_authenticated_delete on public.arkline_po_update_reasons;

create policy arkline_po_update_reasons_authenticated_select
on public.arkline_po_update_reasons
for select
to authenticated
using (true);

create policy arkline_po_update_reasons_authenticated_insert
on public.arkline_po_update_reasons
for insert
to authenticated
with check (true);

create policy arkline_po_update_reasons_authenticated_update
on public.arkline_po_update_reasons
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_update_reasons_authenticated_delete
on public.arkline_po_update_reasons
for delete
to authenticated
using (true);
