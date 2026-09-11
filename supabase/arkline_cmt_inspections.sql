create extension if not exists pgcrypto;

create table if not exists public.arkline_cmt_inspections (
  id uuid primary key default gen_random_uuid(),
  po_id text not null,
  arkline_po_item_id uuid not null references public.arkline_po_items(id) on update cascade on delete cascade,
  sku_induk text not null,
  product_name text not null,
  kategori_pengadaan text null,
  inspection_type text not null default 'FINAL',
  round_number integer not null default 1,
  order_qty integer not null default 0,
  sampling_qty integer not null default 0,
  cutting_qty integer not null default 0,
  cutting_pct numeric(6,2) not null default 0,
  printing_qty integer not null default 0,
  printing_pct numeric(6,2) not null default 0,
  sewing_qty integer not null default 0,
  sewing_pct numeric(6,2) not null default 0,
  acceptance_standard integer not null default 0,
  reject_standard integer not null default 0,
  accept_qty integer not null default 0,
  reject_qty integer not null default 0,
  inspection_result text null,
  prefinal_pdf_path text null,
  measurement_pdf_path text null,
  defect_photo_urls jsonb not null default '[]'::jsonb,
  qc_information jsonb not null default '{}'::jsonb,
  accessories_checklist jsonb not null default '{}'::jsonb,
  packing_information jsonb not null default '{}'::jsonb,
  notes text null,
  inspected_by text null,
  inspection_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_cmt_inspections_po_id_fkey
    foreign key (po_id)
    references public.arkline_pos(po_id)
    on update cascade
    on delete cascade,
  constraint arkline_cmt_inspections_type_check
    check (inspection_type in ('INLINE', 'PREFINAL', 'FINAL')),
  constraint arkline_cmt_inspections_round_check
    check (round_number > 0),
  constraint arkline_cmt_inspections_qty_check
    check (
      order_qty >= 0
      and sampling_qty >= 0
      and cutting_qty >= 0
      and printing_qty >= 0
      and sewing_qty >= 0
      and acceptance_standard >= 0
      and reject_standard >= 0
      and accept_qty >= 0
      and reject_qty >= 0
    ),
  constraint arkline_cmt_inspections_pct_check
    check (
      cutting_pct >= 0
      and cutting_pct <= 100
      and printing_pct >= 0
      and printing_pct <= 100
      and sewing_pct >= 0
      and sewing_pct <= 100
    ),
  constraint arkline_cmt_inspections_result_check
    check (inspection_result is null or inspection_result in ('PASSED', 'REJECTED', 'REWORK')),
  constraint arkline_cmt_inspections_item_type_round_key
    unique (arkline_po_item_id, inspection_type, round_number)
);

create table if not exists public.arkline_cmt_inspection_defects (
  id uuid primary key default gen_random_uuid(),
  cmt_inspection_id uuid not null references public.arkline_cmt_inspections(id) on update cascade on delete cascade,
  reject_reason_id uuid null references public.arkline_qc_reject_reasons(id) on update cascade on delete set null,
  reject_reason_name text not null,
  major_qty integer not null default 0,
  minor_qty integer not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_cmt_inspection_defects_qty_check
    check (major_qty >= 0 and minor_qty >= 0 and major_qty + minor_qty > 0),
  constraint arkline_cmt_inspection_defects_reason_key
    unique (cmt_inspection_id, reject_reason_name)
);

create index if not exists arkline_cmt_inspections_po_id_idx
  on public.arkline_cmt_inspections (po_id);

create index if not exists arkline_cmt_inspections_po_item_idx
  on public.arkline_cmt_inspections (arkline_po_item_id);

create index if not exists arkline_cmt_inspections_type_round_idx
  on public.arkline_cmt_inspections (inspection_type, round_number);

create index if not exists arkline_cmt_inspections_result_idx
  on public.arkline_cmt_inspections (inspection_result);

create index if not exists arkline_cmt_inspection_defects_inspection_idx
  on public.arkline_cmt_inspection_defects (cmt_inspection_id);

create index if not exists arkline_cmt_inspection_defects_reason_idx
  on public.arkline_cmt_inspection_defects (reject_reason_id);

alter table public.arkline_cmt_inspections
  add column if not exists printing_qty integer not null default 0,
  add column if not exists printing_pct numeric(6,2) not null default 0,
  add column if not exists acceptance_standard integer not null default 0,
  add column if not exists reject_standard integer not null default 0,
  add column if not exists measurement_pdf_path text null,
  add column if not exists qc_information jsonb not null default '{}'::jsonb,
  add column if not exists accessories_checklist jsonb not null default '{}'::jsonb,
  add column if not exists packing_information jsonb not null default '{}'::jsonb,
  add column if not exists inspected_by text null;

alter table public.arkline_cmt_inspections
  drop column if exists created_by;

alter table public.arkline_cmt_inspections
  drop constraint if exists arkline_cmt_inspections_type_check,
  add constraint arkline_cmt_inspections_type_check
    check (inspection_type in ('INLINE', 'PREFINAL', 'FINAL'));

alter table public.arkline_cmt_inspections
  drop constraint if exists arkline_cmt_inspections_qty_check,
  add constraint arkline_cmt_inspections_qty_check
    check (
      order_qty >= 0
      and sampling_qty >= 0
      and cutting_qty >= 0
      and printing_qty >= 0
      and sewing_qty >= 0
      and acceptance_standard >= 0
      and reject_standard >= 0
      and accept_qty >= 0
      and reject_qty >= 0
    );

alter table public.arkline_cmt_inspections
  drop constraint if exists arkline_cmt_inspections_pct_check,
  add constraint arkline_cmt_inspections_pct_check
    check (
      cutting_pct >= 0
      and cutting_pct <= 100
      and printing_pct >= 0
      and printing_pct <= 100
      and sewing_pct >= 0
      and sewing_pct <= 100
    );

create or replace function public.set_arkline_cmt_inspections_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_cmt_inspections_set_updated_at on public.arkline_cmt_inspections;
create trigger arkline_cmt_inspections_set_updated_at
before update on public.arkline_cmt_inspections
for each row
execute function public.set_arkline_cmt_inspections_updated_at();

drop trigger if exists arkline_cmt_inspection_defects_set_updated_at on public.arkline_cmt_inspection_defects;
create trigger arkline_cmt_inspection_defects_set_updated_at
before update on public.arkline_cmt_inspection_defects
for each row
execute function public.set_arkline_cmt_inspections_updated_at();

alter table public.arkline_cmt_inspections enable row level security;
alter table public.arkline_cmt_inspection_defects enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.arkline_cmt_inspections to authenticated;
grant select, insert, update, delete on public.arkline_cmt_inspection_defects to authenticated;

drop policy if exists arkline_cmt_inspections_authenticated_select on public.arkline_cmt_inspections;
drop policy if exists arkline_cmt_inspections_authenticated_insert on public.arkline_cmt_inspections;
drop policy if exists arkline_cmt_inspections_authenticated_update on public.arkline_cmt_inspections;
drop policy if exists arkline_cmt_inspections_authenticated_delete on public.arkline_cmt_inspections;

create policy arkline_cmt_inspections_authenticated_select
on public.arkline_cmt_inspections
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
      and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host')
  )
);

create policy arkline_cmt_inspections_authenticated_insert
on public.arkline_cmt_inspections
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
);

create policy arkline_cmt_inspections_authenticated_update
on public.arkline_cmt_inspections
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

create policy arkline_cmt_inspections_authenticated_delete
on public.arkline_cmt_inspections
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
      and profile.role in ('admin', 'arkline_merchandiser')
  )
);

drop policy if exists arkline_cmt_inspection_defects_authenticated_select on public.arkline_cmt_inspection_defects;
drop policy if exists arkline_cmt_inspection_defects_authenticated_insert on public.arkline_cmt_inspection_defects;
drop policy if exists arkline_cmt_inspection_defects_authenticated_update on public.arkline_cmt_inspection_defects;
drop policy if exists arkline_cmt_inspection_defects_authenticated_delete on public.arkline_cmt_inspection_defects;

create policy arkline_cmt_inspection_defects_authenticated_select
on public.arkline_cmt_inspection_defects
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
      and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host')
  )
);

create policy arkline_cmt_inspection_defects_authenticated_insert
on public.arkline_cmt_inspection_defects
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
);

create policy arkline_cmt_inspection_defects_authenticated_update
on public.arkline_cmt_inspection_defects
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

create policy arkline_cmt_inspection_defects_authenticated_delete
on public.arkline_cmt_inspection_defects
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
      and profile.role in ('admin', 'arkline_merchandiser')
  )
);

insert into storage.buckets (id, name, public)
values ('arkline-po', 'arkline-po', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists arkline_cmt_inspection_files_select on storage.objects;
drop policy if exists arkline_cmt_inspection_files_insert on storage.objects;
drop policy if exists arkline_cmt_inspection_files_update on storage.objects;
drop policy if exists arkline_cmt_inspection_files_delete on storage.objects;

create policy arkline_cmt_inspection_files_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'arkline-po'
  and exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host')
  )
);

create policy arkline_cmt_inspection_files_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'arkline-po'
  and exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
);

create policy arkline_cmt_inspection_files_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'arkline-po'
  and exists (
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
  bucket_id = 'arkline-po'
  and exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host')
  )
);

create policy arkline_cmt_inspection_files_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'arkline-po'
  and exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = (select auth.uid())
        or profile.id = (select auth.uid())::text
      )
      and profile.role in ('admin', 'arkline_merchandiser')
  )
);
