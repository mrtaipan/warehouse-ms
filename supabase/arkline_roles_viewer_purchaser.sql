begin;

alter table public.dir_user_profiles
drop constraint if exists user_profiles_role_check;

update public.dir_user_profiles
set role = 'arkline_viewer'
where role = 'arkline_staff';

update public.dir_user_profiles
set role = 'arkline_purchaser'
where role = 'arkline_approver';

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
    'arkline_viewer',
    'arkline_purchaser'
  )
);

delete from public.dir_user_roles
where role in ('arkline_staff', 'arkline_approver', 'arkline_viewer', 'arkline_purchaser');

insert into public.dir_user_roles (role, permission_code)
values
  ('arkline_purchaser', 'arkline.finance.reimbursement.view'),
  ('arkline_purchaser', 'arkline.finance.reimbursement.submit'),
  ('arkline_purchaser', 'arkline.finance.reimbursement.approve'),
  ('arkline_purchaser', 'arkline.finance.reimbursement.pay');

commit;
