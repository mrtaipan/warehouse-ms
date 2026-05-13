create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop table if exists public.arkline_qc cascade;

create table public.arkline_qc (
  id uuid primary key default gen_random_uuid(),
  po_id text null references public.arkline_pos(po_id) on update cascade on delete cascade,
  arkline_po_item_id uuid null references public.arkline_po_items(id) on update cascade on delete cascade,
  sku_induk text null,
  assigned_to text not null,
  allocated_qty integer not null default 0 check (allocated_qty >= 0),
  qty_in integer not null default 0 check (qty_in >= 0),
  qty_a integer not null default 0 check (qty_a >= 0),
  qty_b integer not null default 0 check (qty_b >= 0),
  qty_c integer not null default 0 check (qty_c >= 0),
  locked_qty integer not null default 0 check (locked_qty >= 0),
  model_name text not null,
  photo_url text null,
  status text not null default 'queued',
  stopwatch_seconds integer not null default 0 check (stopwatch_seconds >= 0),
  pause_reason text null,
  paused_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_qc_status_check check (status in ('queued', 'in_progress', 'paused', 'done'))
);

create index if not exists arkline_qc_po_id_idx
  on public.arkline_qc (po_id);

create index if not exists arkline_qc_po_item_idx
  on public.arkline_qc (arkline_po_item_id);

create index if not exists arkline_qc_assigned_status_idx
  on public.arkline_qc (assigned_to, status);

create index if not exists arkline_qc_model_idx
  on public.arkline_qc (model_name);

drop trigger if exists arkline_qc_set_updated_at on public.arkline_qc;

create trigger arkline_qc_set_updated_at
before update on public.arkline_qc
for each row
execute function public.set_updated_at();

alter table public.arkline_qc enable row level security;

drop policy if exists arkline_qc_authenticated_select on public.arkline_qc;
drop policy if exists arkline_qc_authenticated_insert on public.arkline_qc;
drop policy if exists arkline_qc_authenticated_update on public.arkline_qc;
drop policy if exists arkline_qc_authenticated_delete on public.arkline_qc;

create policy arkline_qc_authenticated_select
on public.arkline_qc
for select
to authenticated
using (true);

create policy arkline_qc_authenticated_insert
on public.arkline_qc
for insert
to authenticated
with check (true);

create policy arkline_qc_authenticated_update
on public.arkline_qc
for update
to authenticated
using (true)
with check (true);

create policy arkline_qc_authenticated_delete
on public.arkline_qc
for delete
to authenticated
using (true);
