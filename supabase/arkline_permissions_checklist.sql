begin;

delete from public.dir_user_permissions
where code in (
  'arkline.overview.view',
  'arkline.directory.view',
  'arkline.directory.bom.view',
  'arkline.directory.create',
  'arkline.progress.view',
  'arkline.progress.kanban.view',
  'arkline.progress.calendar.view',
  'arkline.progress.products.view',
  'arkline.production-planning.view',
  'arkline.financial-management.view'
);

insert into public.dir_user_permissions (code, label, description)
values
  ('arkline.overview.view', 'View Arkline overview', 'Show Arkline overview page and allow opening the overview dashboard.'),
  ('arkline.directory.view', 'View product directory', 'Open Arkline Product Directory page.'),
  ('arkline.directory.bom.view', 'View BOM', 'Open BOM tab inside Arkline Product Directory.'),
  ('arkline.directory.create', 'Create or edit SKU', 'Allow creating new SKU and editing product entries in Arkline Product Directory.'),
  ('arkline.progress.view', 'View progress snapshot', 'Open Arkline Progress Snapshot page.'),
  ('arkline.progress.kanban.view', 'View progress kanban', 'Allow using the Kanban mode inside Arkline Progress Snapshot.'),
  ('arkline.progress.calendar.view', 'View progress calendar', 'Allow using the Calendar mode inside Arkline Progress Snapshot.'),
  ('arkline.progress.products.view', 'View product snapshot', 'Allow using the Product Snapshot mode inside Arkline Progress Snapshot.'),
  ('arkline.production-planning.view', 'View production planning', 'Open Arkline Production Planning module.'),
  ('arkline.financial-management.view', 'View financial management', 'Open Arkline Financial Management module.');

delete from public.dir_user_roles
where role in ('arkline_viewer', 'arkline_purchaser')
  and permission_code in (
    'arkline.overview.view',
    'arkline.directory.view',
    'arkline.directory.bom.view',
    'arkline.directory.create',
    'arkline.progress.view',
    'arkline.progress.kanban.view',
    'arkline.progress.calendar.view',
    'arkline.progress.products.view',
    'arkline.production-planning.view',
    'arkline.financial-management.view'
  );

insert into public.dir_user_roles (role, permission_code)
values
  ('arkline_viewer', 'arkline.overview.view'),
  ('arkline_viewer', 'arkline.directory.view'),
  ('arkline_viewer', 'arkline.progress.view'),
  ('arkline_viewer', 'arkline.progress.calendar.view'),
  ('arkline_viewer', 'arkline.progress.products.view'),
  ('arkline_purchaser', 'arkline.overview.view'),
  ('arkline_purchaser', 'arkline.directory.view'),
  ('arkline_purchaser', 'arkline.directory.bom.view'),
  ('arkline_purchaser', 'arkline.directory.create'),
  ('arkline_purchaser', 'arkline.progress.view'),
  ('arkline_purchaser', 'arkline.progress.kanban.view'),
  ('arkline_purchaser', 'arkline.progress.calendar.view'),
  ('arkline_purchaser', 'arkline.progress.products.view'),
  ('arkline_purchaser', 'arkline.production-planning.view'),
  ('arkline_purchaser', 'arkline.financial-management.view');

commit;
