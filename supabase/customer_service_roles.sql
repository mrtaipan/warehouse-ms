begin;

alter table public.dir_user_roles
  drop constraint if exists role_permissions_role_check;

alter table public.dir_user_roles
  add constraint role_permissions_role_check
  check (
    "role" is null
    or "role" in (
      'admin',
      'hrga',
      'leader',
      'mob_cs',
      'oi_cs',
      'arkline_cs',
      'warehouse_leader',
      'packing_coordinator',
      'packing_staff',
      'qc_coordinator',
      'qc_staff',
      'qc_inspector',
      'storage_coordinator',
      'storage_staff',
      'inbound_coordinator',
      'inbound_staff',
      'arkline_staff',
      'arkline_approver',
      'arkline_viewer',
      'arkline_purchaser',
      'arkline_merchandiser',
      'arkline_host',
      'external',
      'guest'
    )
  );

insert into public.dir_user_roles ("role", permission_code)
select 'mob_cs', src.permission_code
from public.dir_user_roles src
where src."role" = 'leader'
  and not exists (
    select 1
    from public.dir_user_roles existing
    where existing."role" = 'mob_cs'
      and existing.permission_code = src.permission_code
  );

insert into public.dir_user_roles ("role", permission_code)
select 'oi_cs', src.permission_code
from public.dir_user_roles src
where src."role" = 'leader'
  and not exists (
    select 1
    from public.dir_user_roles existing
    where existing."role" = 'oi_cs'
      and existing.permission_code = src.permission_code
  );

insert into public.dir_user_roles ("role", permission_code)
select 'arkline_cs', src.permission_code
from public.dir_user_roles src
where src."role" = 'guest'
  and not exists (
    select 1
    from public.dir_user_roles existing
    where existing."role" = 'arkline_cs'
      and existing.permission_code = src.permission_code
  );

commit;
