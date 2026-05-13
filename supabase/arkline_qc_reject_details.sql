create extension if not exists pgcrypto;

create table if not exists public.arkline_qc_reject_reasons (
  id uuid primary key default gen_random_uuid(),
  reason_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_qc_reject_reasons_name_unique unique (reason_name)
);

create table if not exists public.arkline_qc_reject_details (
  id uuid primary key default gen_random_uuid(),
  arkline_qc_id uuid not null references public.arkline_qc(id) on update cascade on delete cascade,
  po_id text null,
  arkline_po_item_id uuid null,
  sku_induk text null,
  model_name text not null,
  grade text not null,
  size text not null,
  reject_reason_id uuid not null references public.arkline_qc_reject_reasons(id) on update cascade on delete restrict,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_qc_reject_details_grade_check check (grade in ('B', 'C'))
);

create table if not exists public.arkline_qc_reject_adjustments (
  id uuid primary key default gen_random_uuid(),
  po_id text null,
  arkline_po_item_id uuid null,
  sku_induk text null,
  model_name text not null,
  adjustment_type text not null,
  qty integer not null default 0 check (qty >= 0),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_qc_reject_adjustments_type_check
    check (adjustment_type in ('bc_to_a', 'inspector_data_error'))
);

create index if not exists arkline_qc_reject_details_qc_idx
  on public.arkline_qc_reject_details (arkline_qc_id);

create index if not exists arkline_qc_reject_details_po_sku_idx
  on public.arkline_qc_reject_details (po_id, sku_induk);

create index if not exists arkline_qc_reject_details_reason_idx
  on public.arkline_qc_reject_details (reject_reason_id);

create index if not exists arkline_qc_reject_adjustments_po_sku_idx
  on public.arkline_qc_reject_adjustments (po_id, sku_induk);

create or replace function public.set_arkline_qc_reject_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_qc_reject_reasons_set_updated_at on public.arkline_qc_reject_reasons;
create trigger arkline_qc_reject_reasons_set_updated_at
before update on public.arkline_qc_reject_reasons
for each row
execute function public.set_arkline_qc_reject_updated_at();

drop trigger if exists arkline_qc_reject_details_set_updated_at on public.arkline_qc_reject_details;
create trigger arkline_qc_reject_details_set_updated_at
before update on public.arkline_qc_reject_details
for each row
execute function public.set_arkline_qc_reject_updated_at();

drop trigger if exists arkline_qc_reject_adjustments_set_updated_at on public.arkline_qc_reject_adjustments;
create trigger arkline_qc_reject_adjustments_set_updated_at
before update on public.arkline_qc_reject_adjustments
for each row
execute function public.set_arkline_qc_reject_updated_at();

alter table public.arkline_qc_reject_reasons enable row level security;
alter table public.arkline_qc_reject_details enable row level security;
alter table public.arkline_qc_reject_adjustments enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.arkline_qc_reject_reasons to authenticated;
grant select, insert, update, delete on public.arkline_qc_reject_details to authenticated;
grant select, insert, update, delete on public.arkline_qc_reject_adjustments to authenticated;

drop policy if exists arkline_qc_reject_reasons_authenticated_select on public.arkline_qc_reject_reasons;
drop policy if exists arkline_qc_reject_reasons_authenticated_insert on public.arkline_qc_reject_reasons;
drop policy if exists arkline_qc_reject_reasons_authenticated_update on public.arkline_qc_reject_reasons;
drop policy if exists arkline_qc_reject_reasons_authenticated_delete on public.arkline_qc_reject_reasons;

create policy arkline_qc_reject_reasons_authenticated_select
on public.arkline_qc_reject_reasons
for select
to authenticated
using (true);

create policy arkline_qc_reject_reasons_authenticated_insert
on public.arkline_qc_reject_reasons
for insert
to authenticated
with check (true);

create policy arkline_qc_reject_reasons_authenticated_update
on public.arkline_qc_reject_reasons
for update
to authenticated
using (true)
with check (true);

create policy arkline_qc_reject_reasons_authenticated_delete
on public.arkline_qc_reject_reasons
for delete
to authenticated
using (true);

drop policy if exists arkline_qc_reject_details_authenticated_select on public.arkline_qc_reject_details;
drop policy if exists arkline_qc_reject_details_authenticated_insert on public.arkline_qc_reject_details;
drop policy if exists arkline_qc_reject_details_authenticated_update on public.arkline_qc_reject_details;
drop policy if exists arkline_qc_reject_details_authenticated_delete on public.arkline_qc_reject_details;

create policy arkline_qc_reject_details_authenticated_select
on public.arkline_qc_reject_details
for select
to authenticated
using (true);

create policy arkline_qc_reject_details_authenticated_insert
on public.arkline_qc_reject_details
for insert
to authenticated
with check (true);

create policy arkline_qc_reject_details_authenticated_update
on public.arkline_qc_reject_details
for update
to authenticated
using (true)
with check (true);

create policy arkline_qc_reject_details_authenticated_delete
on public.arkline_qc_reject_details
for delete
to authenticated
using (true);

drop policy if exists arkline_qc_reject_adjustments_authenticated_select on public.arkline_qc_reject_adjustments;
drop policy if exists arkline_qc_reject_adjustments_authenticated_insert on public.arkline_qc_reject_adjustments;
drop policy if exists arkline_qc_reject_adjustments_authenticated_update on public.arkline_qc_reject_adjustments;
drop policy if exists arkline_qc_reject_adjustments_authenticated_delete on public.arkline_qc_reject_adjustments;

create policy arkline_qc_reject_adjustments_authenticated_select
on public.arkline_qc_reject_adjustments
for select
to authenticated
using (true);

create policy arkline_qc_reject_adjustments_authenticated_insert
on public.arkline_qc_reject_adjustments
for insert
to authenticated
with check (true);

create policy arkline_qc_reject_adjustments_authenticated_update
on public.arkline_qc_reject_adjustments
for update
to authenticated
using (true)
with check (true);

create policy arkline_qc_reject_adjustments_authenticated_delete
on public.arkline_qc_reject_adjustments
for delete
to authenticated
using (true);
