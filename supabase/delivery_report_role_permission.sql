-- Add Delivery Report to the role permission matrix.
-- Default: every non-admin role can view it, so admins can later remove access from the UI by unchecking this permission.

insert into public.dir_user_permissions (code, label, description)
values
  ('delivery_report.view', 'View Delivery Report', 'View access for Delivery Report System in WMS.')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

insert into public.dir_user_roles (role, permission_code)
select role, 'delivery_report.view'
from (
  values
    ('guest'),
    ('hrga'),
    ('leader'),
    ('warehouse_leader'),
    ('packing_coordinator'),
    ('packing_staff'),
    ('qc_coordinator'),
    ('qc_staff'),
    ('qc_inspector'),
    ('storage_coordinator'),
    ('storage_staff'),
    ('inbound_coordinator'),
    ('inbound_staff'),
    ('arkline_staff'),
    ('arkline_merchandiser'),
    ('arkline_host')
) as seed(role)
on conflict (role, permission_code) do nothing;
