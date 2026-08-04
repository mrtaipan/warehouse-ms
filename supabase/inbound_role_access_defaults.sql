-- Apply the intended Inbound role defaults without touching unrelated module access.

begin;

insert into public.dir_user_permissions (code, label, description)
values
  ('inbound.receiving.view', 'View Inbound Receiving', 'View access for Inbound Receiving in Inbound.'),
  ('inbound.receiving.add', 'Add Inbound Receiving', 'Add access for Inbound Receiving in Inbound.'),
  ('inbound.receiving.edit', 'Edit Inbound Receiving', 'Edit access for Inbound Receiving in Inbound.'),
  ('inbound.unload.view', 'View Inbound Unload', 'View access for Inbound Unload in Inbound.'),
  ('inbound.unload.add', 'Add Inbound Unload', 'Add access for Inbound Unload in Inbound.'),
  ('inbound.unload.edit', 'Edit Inbound Unload', 'Edit access for Inbound Unload in Inbound.')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

delete from public.dir_user_roles
where role in ('inbound_staff', 'leader')
  and permission_code like 'inbound.%';

delete from public.dir_user_roles
where role = 'inbound_coordinator'
  and permission_code in (
    'inbound.overview.view',
    'inbound.new.view',
    'inbound.new.add',
    'inbound.detail.view',
    'inbound.edit.view',
    'inbound.edit.edit',
    'inbound.qc.view'
  );

insert into public.dir_user_roles (role, permission_code)
values
  ('inbound_staff', 'inbound.receiving.view'),
  ('inbound_staff', 'inbound.receiving.edit'),
  ('inbound_staff', 'inbound.unload.view'),
  ('inbound_staff', 'inbound.unload.add'),
  ('inbound_coordinator', 'inbound.receiving.view'),
  ('inbound_coordinator', 'inbound.receiving.add'),
  ('inbound_coordinator', 'inbound.receiving.edit'),
  ('inbound_coordinator', 'inbound.unload.view'),
  ('inbound_coordinator', 'inbound.unload.add'),
  ('inbound_coordinator', 'inbound.unload.edit'),
  ('leader', 'inbound.unload.view')
on conflict (role, permission_code) do nothing;

commit;
