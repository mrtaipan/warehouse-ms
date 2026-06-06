begin;

alter table public.dir_user_profiles
drop constraint if exists user_profiles_role_check;

alter table public.dir_user_profiles
add constraint user_profiles_role_check
check (
  role in (
    'admin',
    'storage_staff',
    'storage_coordinator',
    'inbound_staff',
    'qc_coordinator',
    'qc_staff',
    'qc_inspector',
    'packing_staff',
    'hrga',
    'hrga_approver',
    'arkline_viewer',
    'arkline_purchaser'
  )
);

delete from public.dir_user_roles
where role = 'hrga'
  and permission_code like 'arkline.%';

insert into public.dir_user_roles (role, permission_code)
values
  ('hrga', 'arkline.overview.view'),
  ('hrga', 'arkline.directory.view'),
  ('hrga', 'arkline.directory.bom.view'),
  ('hrga', 'arkline.progress.view'),
  ('hrga', 'arkline.progress.kanban.view'),
  ('hrga', 'arkline.progress.calendar.view'),
  ('hrga', 'arkline.progress.products.view'),
  ('hrga', 'arkline.production-planning.view'),
  ('hrga', 'arkline.financial-management.view');

commit;
