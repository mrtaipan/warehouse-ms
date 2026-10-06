create extension if not exists pgcrypto;

create table if not exists public.arkline_daily_production_reports (
  id uuid primary key default gen_random_uuid(),
  po_id text not null,
  arkline_po_item_id uuid not null references public.arkline_po_items(id) on update cascade on delete cascade,
  sku_induk text not null,
  product_name text not null,
  kategori_pengadaan text null,
  production_line text not null,
  report_date date not null default current_date,
  order_qty integer not null default 0,
  submitted_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_daily_production_reports_po_fkey
    foreign key (po_id)
    references public.arkline_pos(po_id)
    on update cascade
    on delete cascade,
  constraint arkline_daily_production_reports_qty_check
    check (order_qty >= 0),
  constraint arkline_daily_production_reports_line_check
    check (length(trim(production_line)) > 0),
  constraint arkline_daily_production_reports_daily_key
    unique (arkline_po_item_id, production_line, report_date)
);

create table if not exists public.arkline_daily_production_processes (
  id uuid primary key default gen_random_uuid(),
  daily_production_report_id uuid not null references public.arkline_daily_production_reports(id) on update cascade on delete cascade,
  process_type text not null,
  plan_date date null,
  actual_starting_date date null,
  output_qty integer not null default 0,
  reject_in_process integer not null default 0,
  notes text null,
  actual_finished_date date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_daily_production_processes_type_check
    check (process_type in ('CUTTING', 'SEWING', 'PRINTING', 'FINISHING')),
  constraint arkline_daily_production_processes_qty_check
    check (output_qty >= 0 and reject_in_process >= 0),
  constraint arkline_daily_production_processes_type_key
    unique (daily_production_report_id, process_type)
);

create index if not exists arkline_daily_production_reports_po_item_idx
  on public.arkline_daily_production_reports (arkline_po_item_id, report_date desc);

create index if not exists arkline_daily_production_reports_po_idx
  on public.arkline_daily_production_reports (po_id, report_date desc);

create index if not exists arkline_daily_production_processes_report_idx
  on public.arkline_daily_production_processes (daily_production_report_id, process_type);

create or replace function public.set_arkline_daily_production_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_daily_production_reports_set_updated_at on public.arkline_daily_production_reports;
create trigger arkline_daily_production_reports_set_updated_at
before update on public.arkline_daily_production_reports
for each row
execute function public.set_arkline_daily_production_updated_at();

drop trigger if exists arkline_daily_production_processes_set_updated_at on public.arkline_daily_production_processes;
create trigger arkline_daily_production_processes_set_updated_at
before update on public.arkline_daily_production_processes
for each row
execute function public.set_arkline_daily_production_updated_at();

alter table public.arkline_daily_production_reports enable row level security;
alter table public.arkline_daily_production_processes enable row level security;

grant select, insert, update, delete on public.arkline_daily_production_reports to authenticated;
grant select, insert, update, delete on public.arkline_daily_production_processes to authenticated;

drop policy if exists arkline_daily_production_reports_select on public.arkline_daily_production_reports;
create policy arkline_daily_production_reports_select
on public.arkline_daily_production_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
  )
);

drop policy if exists arkline_daily_production_reports_insert on public.arkline_daily_production_reports;
create policy arkline_daily_production_reports_insert
on public.arkline_daily_production_reports
for insert
to authenticated
with check (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
  )
);

drop policy if exists arkline_daily_production_reports_update on public.arkline_daily_production_reports;
create policy arkline_daily_production_reports_update
on public.arkline_daily_production_reports
for update
to authenticated
using (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
)
with check (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
);

drop policy if exists arkline_daily_production_reports_delete on public.arkline_daily_production_reports;
create policy arkline_daily_production_reports_delete
on public.arkline_daily_production_reports
for delete
to authenticated
using (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
);

drop policy if exists arkline_daily_production_processes_select on public.arkline_daily_production_processes;
create policy arkline_daily_production_processes_select
on public.arkline_daily_production_processes
for select
to authenticated
using (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
  )
);

drop policy if exists arkline_daily_production_processes_insert on public.arkline_daily_production_processes;
create policy arkline_daily_production_processes_insert
on public.arkline_daily_production_processes
for insert
to authenticated
with check (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
  )
);

drop policy if exists arkline_daily_production_processes_update on public.arkline_daily_production_processes;
create policy arkline_daily_production_processes_update
on public.arkline_daily_production_processes
for update
to authenticated
using (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
)
with check (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
);

drop policy if exists arkline_daily_production_processes_delete on public.arkline_daily_production_processes;
create policy arkline_daily_production_processes_delete
on public.arkline_daily_production_processes
for delete
to authenticated
using (
  exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
);
