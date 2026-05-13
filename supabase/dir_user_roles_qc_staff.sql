delete from public.dir_user_roles
where role = 'qc_staff';

insert into public.dir_user_roles (role, permission_code)
values
  ('qc_staff', 'qc.receiving.edit'),
  ('qc_staff', 'qc.inspection.do'),
  ('qc_staff', 'qc.confirmation.edit'),
  ('qc_staff', 'qc.retur.view');
