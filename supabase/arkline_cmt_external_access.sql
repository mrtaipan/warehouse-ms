-- Allow external Arkline users to submit CMT inspections.
-- This patch updates policies only; it does not recreate the inspection tables.

grant usage on schema public to authenticated;
grant select, insert, update on public.arkline_cmt_inspections to authenticated;
grant select, insert, update on public.arkline_cmt_inspection_defects to authenticated;

alter table public.arkline_cmt_inspections enable row level security;
alter table public.arkline_cmt_inspection_defects enable row level security;

insert into storage.buckets (id, name, public)
values ('arkline-po', 'arkline-po', false)
on conflict (id) do update
set public = excluded.public;

drop policy if exists arkline_cmt_inspections_authenticated_select on public.arkline_cmt_inspections;
drop policy if exists arkline_cmt_inspections_authenticated_insert on public.arkline_cmt_inspections;
drop policy if exists arkline_cmt_inspections_authenticated_update on public.arkline_cmt_inspections;

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
      and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
  )
);

drop policy if exists arkline_cmt_inspection_defects_authenticated_select on public.arkline_cmt_inspection_defects;
drop policy if exists arkline_cmt_inspection_defects_authenticated_insert on public.arkline_cmt_inspection_defects;
drop policy if exists arkline_cmt_inspection_defects_authenticated_update on public.arkline_cmt_inspection_defects;

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
      and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
  )
);

drop policy if exists arkline_cmt_inspection_files_select on storage.objects;
drop policy if exists arkline_cmt_inspection_files_insert on storage.objects;
drop policy if exists arkline_cmt_inspection_files_update on storage.objects;

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
      and profile.role in ('admin', 'arkline_staff', 'arkline_merchandiser', 'arkline_host', 'external')
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
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
      and profile.role in ('admin', 'arkline_merchandiser', 'arkline_host', 'external')
  )
);
