insert into public.dir_user_permissions (code, label, description)
values
  ('storage.location.view', 'View Storage Location', 'View access for Storage Location in Storage.')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

insert into public.dir_user_roles (role, permission_code)
values
  ('qc_coordinator', 'storage.location.view')
on conflict (role, permission_code) do nothing;
