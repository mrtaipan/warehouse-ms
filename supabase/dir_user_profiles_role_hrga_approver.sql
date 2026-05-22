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
    'hrga_approver',
    'arkline_staff',
    'arkline_approver'
  )
);
