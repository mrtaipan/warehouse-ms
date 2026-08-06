begin;

create extension if not exists pgcrypto;

create table if not exists public.operations_calendar_targets (
  id uuid primary key default gen_random_uuid(),
  target_date date not null,
  division_key text not null,
  grn_number text not null,
  brand_name text null,
  status text not null default 'OPEN',
  created_by text null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operations_calendar_manual_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  division_key text not null,
  title text not null,
  description text null,
  pic_name text null,
  created_by text null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.operations_calendar_targets
  drop constraint if exists operations_calendar_targets_division_key_check;

alter table public.operations_calendar_targets
  add constraint operations_calendar_targets_division_key_check
  check (division_key in ('inbound', 'qc', 'packing', 'storage'));

alter table public.operations_calendar_targets
  drop constraint if exists operations_calendar_targets_status_check;

alter table public.operations_calendar_targets
  add constraint operations_calendar_targets_status_check
  check (status in ('OPEN', 'DONE', 'CANCELLED'));

alter table public.operations_calendar_targets
  drop constraint if exists operations_calendar_targets_target_qty_check;

alter table public.operations_calendar_targets
  drop column if exists category_name,
  drop column if exists subcategory_name,
  drop column if exists item_name,
  drop column if exists target_qty,
  drop column if exists notes;

alter table public.operations_calendar_manual_reports
  drop constraint if exists operations_calendar_manual_reports_division_key_check;

alter table public.operations_calendar_manual_reports
  add constraint operations_calendar_manual_reports_division_key_check
  check (division_key in ('inbound', 'qc', 'packing', 'storage'));

create index if not exists operations_calendar_targets_date_division_idx
  on public.operations_calendar_targets (target_date, division_key);

create index if not exists operations_calendar_targets_grn_idx
  on public.operations_calendar_targets (grn_number);

create index if not exists operations_calendar_manual_reports_date_division_idx
  on public.operations_calendar_manual_reports (report_date, division_key);

create or replace function public.set_operations_calendar_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_operations_calendar_targets_updated_at on public.operations_calendar_targets;

create trigger set_operations_calendar_targets_updated_at
before update on public.operations_calendar_targets
for each row
execute function public.set_operations_calendar_updated_at();

drop trigger if exists set_operations_calendar_manual_reports_updated_at on public.operations_calendar_manual_reports;

create trigger set_operations_calendar_manual_reports_updated_at
before update on public.operations_calendar_manual_reports
for each row
execute function public.set_operations_calendar_updated_at();

alter table public.operations_calendar_targets enable row level security;
alter table public.operations_calendar_manual_reports enable row level security;

grant select, insert, update, delete on public.operations_calendar_targets to authenticated;
grant select, insert, update, delete on public.operations_calendar_manual_reports to authenticated;

drop policy if exists operations_calendar_targets_authenticated_select on public.operations_calendar_targets;
drop policy if exists operations_calendar_targets_authenticated_insert on public.operations_calendar_targets;
drop policy if exists operations_calendar_targets_authenticated_update on public.operations_calendar_targets;
drop policy if exists operations_calendar_targets_authenticated_delete on public.operations_calendar_targets;

create policy operations_calendar_targets_authenticated_select
on public.operations_calendar_targets
for select
to authenticated
using (true);

create policy operations_calendar_targets_authenticated_insert
on public.operations_calendar_targets
for insert
to authenticated
with check (true);

create policy operations_calendar_targets_authenticated_update
on public.operations_calendar_targets
for update
to authenticated
using (true)
with check (true);

create policy operations_calendar_targets_authenticated_delete
on public.operations_calendar_targets
for delete
to authenticated
using (true);

drop policy if exists operations_calendar_manual_reports_authenticated_select on public.operations_calendar_manual_reports;
drop policy if exists operations_calendar_manual_reports_authenticated_insert on public.operations_calendar_manual_reports;
drop policy if exists operations_calendar_manual_reports_authenticated_update on public.operations_calendar_manual_reports;
drop policy if exists operations_calendar_manual_reports_authenticated_delete on public.operations_calendar_manual_reports;

create policy operations_calendar_manual_reports_authenticated_select
on public.operations_calendar_manual_reports
for select
to authenticated
using (true);

create policy operations_calendar_manual_reports_authenticated_insert
on public.operations_calendar_manual_reports
for insert
to authenticated
with check (true);

create policy operations_calendar_manual_reports_authenticated_update
on public.operations_calendar_manual_reports
for update
to authenticated
using (true)
with check (true);

create policy operations_calendar_manual_reports_authenticated_delete
on public.operations_calendar_manual_reports
for delete
to authenticated
using (true);

commit;
