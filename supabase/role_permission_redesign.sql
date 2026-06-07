begin;

update public.dir_user_profiles
set role = case
  when role = 'hrga_approver' then 'hrga'
  when role = 'arkline_viewer' then 'arkline_staff'
  when role = 'arkline_purchaser' then 'arkline_merchandiser'
  when role in (
    'admin',
    'hrga',
    'leader',
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
    'arkline_merchandiser',
    'arkline_host',
    'guest'
  ) then role
  else 'guest'
end;

update public.dir_user_roles
set role = case
  when role = 'hrga_approver' then 'hrga'
  when role = 'arkline_viewer' then 'arkline_staff'
  when role = 'arkline_purchaser' then 'arkline_merchandiser'
  when role in (
    'admin',
    'hrga',
    'leader',
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
    'arkline_merchandiser',
    'arkline_host',
    'guest'
  ) then role
  else 'guest'
end;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.dir_user_profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';

  if constraint_name is not null then
    execute format('alter table public.dir_user_profiles drop constraint %I', constraint_name);
  end if;

  alter table public.dir_user_profiles
    add constraint dir_user_profiles_role_check
    check (
      role in (
        'admin',
        'hrga',
        'leader',
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
        'arkline_merchandiser',
        'arkline_host',
        'guest'
      )
    );
exception
  when duplicate_object then
    null;
end $$;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.dir_user_roles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';

  if constraint_name is not null then
    execute format('alter table public.dir_user_roles drop constraint %I', constraint_name);
  end if;

  alter table public.dir_user_roles
    add constraint role_permissions_role_check
    check (
      role in (
        'admin',
        'hrga',
        'leader',
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
        'arkline_merchandiser',
        'arkline_host',
        'guest'
      )
    );
exception
  when duplicate_object then
    null;
end $$;

delete from public.dir_user_roles
where role <> 'admin';

delete from public.dir_user_permissions
where code like 'profile.self.%'
   or code like 'arkline.finance.reimbursement.%';

insert into public.dir_user_permissions (code, label, description)
values
  ('dashboard.home.view', 'View Dashboard Home', 'View access for Dashboard Home in Dashboard.'),
  ('myarklife.view', 'View MyArklife', 'View access for MyArklife in MyArklife.'),
  ('hrga.home.view', 'View People Management', 'View access for People Management in HRGA.'),
  ('hrga.announcement.view', 'View Announcement', 'View access for Announcement in HRGA.'),
  ('hrga.announcement.add', 'Add Announcement', 'Add access for Announcement in HRGA.'),
  ('hrga.announcement.edit', 'Edit Announcement', 'Edit access for Announcement in HRGA.'),
  ('hrga.announcement.delete', 'Delete Announcement', 'Delete access for Announcement in HRGA.'),
  ('hrga.people.view', 'View People Directory', 'View access for People Directory in HRGA.'),
  ('hrga.people.edit', 'Edit People Directory', 'Edit access for People Directory in HRGA.'),
  ('hrga.public_request_links.view', 'View Public Request Links', 'View access for Public Request Links in HRGA.'),
  ('hrga.public_request_links.edit', 'Edit Public Request Links', 'Edit access for Public Request Links in HRGA.'),
  ('hrga.benefits.view', 'View Benefits Hub', 'View access for Benefits Hub in HRGA.'),
  ('storage.overview.view', 'View Storage Overview', 'View access for Storage Overview in Storage.'),
  ('storage.search.view', 'View Search Storage', 'View access for Search Storage in Storage.'),
  ('storage.registry.view', 'View Registry Storage', 'View access for Registry Storage in Storage.'),
  ('storage.registry.add', 'Add Registry Storage', 'Add access for Registry Storage in Storage.'),
  ('storage.registry.edit', 'Edit Registry Storage', 'Edit access for Registry Storage in Storage.'),
  ('storage.registry.delete', 'Delete Registry Storage', 'Delete access for Registry Storage in Storage.'),
  ('storage.location.view', 'View Storage Location', 'View access for Storage Location in Storage.'),
  ('storage.restock_instruction.view', 'View Restock Instruction', 'View access for Restock Instruction in Storage.'),
  ('storage.restock_submit.view', 'View Restock Submit', 'View access for Restock Submit in Storage.'),
  ('storage.restock_submit.add', 'Add Restock Submit', 'Add access for Restock Submit in Storage.'),
  ('storage.restock_submit.edit', 'Edit Restock Submit', 'Edit access for Restock Submit in Storage.'),
  ('storage.restock_picker.view', 'View Restock Picker', 'View access for Restock Picker in Storage.'),
  ('storage.restock_picker.edit', 'Edit Restock Picker', 'Edit access for Restock Picker in Storage.'),
  ('qc.summary.view', 'View QC Summary', 'View access for QC Summary in Quality Control.'),
  ('qc.receiving.view', 'View QC Receiving', 'View access for QC Receiving in Quality Control.'),
  ('qc.receiving.add', 'Add QC Receiving', 'Add access for QC Receiving in Quality Control.'),
  ('qc.receiving.edit', 'Edit QC Receiving', 'Edit access for QC Receiving in Quality Control.'),
  ('qc.receiving.delete', 'Delete QC Receiving', 'Delete access for QC Receiving in Quality Control.'),
  ('qc.grading_task.view', 'View Grading Task', 'View access for Grading Task in Quality Control.'),
  ('qc.grading_task.add', 'Add Grading Task', 'Add access for Grading Task in Quality Control.'),
  ('qc.grading_task.edit', 'Edit Grading Task', 'Edit access for Grading Task in Quality Control.'),
  ('qc.confirmation.view', 'View QC Confirmation', 'View access for QC Confirmation in Quality Control.'),
  ('qc.confirmation.add', 'Add QC Confirmation', 'Add access for QC Confirmation in Quality Control.'),
  ('qc.confirmation.edit', 'Edit QC Confirmation', 'Edit access for QC Confirmation in Quality Control.'),
  ('qc.retur_report.view', 'View Retur Report', 'View access for Retur Report in Quality Control.'),
  ('inbound.overview.view', 'View Inbound Overview', 'View access for Inbound Overview in Inbound.'),
  ('inbound.new.view', 'View New Inbound', 'View access for New Inbound in Inbound.'),
  ('inbound.new.add', 'Add New Inbound', 'Add access for New Inbound in Inbound.'),
  ('inbound.detail.view', 'View Inbound Detail', 'View access for Inbound Detail in Inbound.'),
  ('inbound.edit.view', 'View Edit Inbound', 'View access for Edit Inbound in Inbound.'),
  ('inbound.edit.edit', 'Edit Edit Inbound', 'Edit access for Edit Inbound in Inbound.'),
  ('inbound.unload.view', 'View Unload', 'View access for Unload in Inbound.'),
  ('inbound.unload.edit', 'Edit Unload', 'Edit access for Unload in Inbound.'),
  ('inbound.receiving.view', 'View Inbound Receiving', 'View access for Inbound Receiving in Inbound.'),
  ('inbound.receiving.edit', 'Edit Inbound Receiving', 'Edit access for Inbound Receiving in Inbound.'),
  ('inbound.qc.view', 'View Inbound QC', 'View access for Inbound QC in Inbound.'),
  ('packing.overview.view', 'View Packing Overview', 'View access for Packing Overview in Packing.'),
  ('packing.receiving.view', 'View Packing Receiving', 'View access for Packing Receiving in Packing.'),
  ('packing.receiving.add', 'Add Packing Receiving', 'Add access for Packing Receiving in Packing.'),
  ('packing.receiving.edit', 'Edit Packing Receiving', 'Edit access for Packing Receiving in Packing.'),
  ('packing.size_breakdown.view', 'View Size Breakdown', 'View access for Size Breakdown in Packing.'),
  ('packing.size_breakdown.edit', 'Edit Size Breakdown', 'Edit access for Size Breakdown in Packing.'),
  ('arkline.overview.view', 'View Arkline Overview', 'View access for Arkline Overview in Arkline.'),
  ('arkline.directory.view', 'View Product Directory Home', 'View access for Product Directory Home in Arkline.'),
  ('arkline.directory.products.view', 'View Product Directory', 'View access for Product Directory in Arkline.'),
  ('arkline.directory.products.add', 'Add Product Directory', 'Add access for Product Directory in Arkline.'),
  ('arkline.directory.products.edit', 'Edit Product Directory', 'Edit access for Product Directory in Arkline.'),
  ('arkline.directory.products.delete', 'Delete Product Directory', 'Delete access for Product Directory in Arkline.'),
  ('arkline.directory.bom.view', 'View BOM', 'View access for BOM in Arkline.'),
  ('arkline.directory.bom.add', 'Add BOM', 'Add access for BOM in Arkline.'),
  ('arkline.directory.bom.edit', 'Edit BOM', 'Edit access for BOM in Arkline.'),
  ('arkline.directory.bom.delete', 'Delete BOM', 'Delete access for BOM in Arkline.'),
  ('arkline.directory.materials.view', 'View Materials', 'View access for Materials in Arkline.'),
  ('arkline.directory.materials.add', 'Add Materials', 'Add access for Materials in Arkline.'),
  ('arkline.directory.materials.edit', 'Edit Materials', 'Edit access for Materials in Arkline.'),
  ('arkline.directory.materials.delete', 'Delete Materials', 'Delete access for Materials in Arkline.'),
  ('arkline.progress_snapshot.view', 'View Progress Snapshot Home', 'View access for Progress Snapshot Home in Arkline.'),
  ('arkline.progress_snapshot.kanban.view', 'View Progress Snapshot Kanban', 'View access for Progress Snapshot Kanban in Arkline.'),
  ('arkline.progress_snapshot.kanban.add', 'Add Progress Snapshot Kanban', 'Add access for Progress Snapshot Kanban in Arkline.'),
  ('arkline.progress_snapshot.kanban.edit', 'Edit Progress Snapshot Kanban', 'Edit access for Progress Snapshot Kanban in Arkline.'),
  ('arkline.progress_snapshot.calendar.view', 'View Progress Snapshot Calendar', 'View access for Progress Snapshot Calendar in Arkline.'),
  ('arkline.progress_snapshot.products.view', 'View Progress Snapshot Products', 'View access for Progress Snapshot Products in Arkline.'),
  ('arkline.production_planning.view', 'View Production Planning Home', 'View access for Production Planning Home in Arkline.'),
  ('arkline.production_orders.view', 'View Production Orders', 'View access for Production Orders in Arkline.'),
  ('arkline.production_orders.add', 'Add Production Orders', 'Add access for Production Orders in Arkline.'),
  ('arkline.production_orders.edit', 'Edit Production Orders', 'Edit access for Production Orders in Arkline.'),
  ('arkline.production_orders.delete', 'Delete Production Orders', 'Delete access for Production Orders in Arkline.'),
  ('arkline.production_orders.print', 'Print Production Orders', 'Print access for Production Orders in Arkline.'),
  ('arkline.material_fulfillment.view', 'View Material Fulfillment', 'View access for Material Fulfillment in Arkline.'),
  ('arkline.material_fulfillment.add', 'Add Material Fulfillment', 'Add access for Material Fulfillment in Arkline.'),
  ('arkline.material_fulfillment.edit', 'Edit Material Fulfillment', 'Edit access for Material Fulfillment in Arkline.'),
  ('arkline.material_fulfillment.delete', 'Delete Material Fulfillment', 'Delete access for Material Fulfillment in Arkline.'),
  ('arkline.financial_management.view', 'View Financial Management Home', 'View access for Financial Management Home in Arkline.'),
  ('arkline.financial_management.payment_submission.view', 'View Payment Submission', 'View access for Payment Submission in Arkline.'),
  ('arkline.financial_management.payment_submission.add', 'Add Payment Submission', 'Add access for Payment Submission in Arkline.'),
  ('arkline.financial_management.payment_submission.edit', 'Edit Payment Submission', 'Edit access for Payment Submission in Arkline.'),
  ('arkline.financial_management.reporting.view', 'View Financial Reporting', 'View access for Financial Reporting in Arkline.'),
  ('settings.user_access.view', 'View User Access', 'View access for User Access in Settings.'),
  ('settings.user_access.edit', 'Edit User Access', 'Edit access for User Access in Settings.')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

insert into public.dir_user_roles (role, permission_code)
select role, permission_code
from (
  values
    ('guest', 'dashboard.home.view'),
    ('guest', 'myarklife.view'),
    ('hrga', 'dashboard.home.view'),
    ('hrga', 'myarklife.view'),
    ('hrga', 'hrga.home.view'),
    ('hrga', 'hrga.announcement.view'),
    ('hrga', 'hrga.announcement.add'),
    ('hrga', 'hrga.announcement.edit'),
    ('hrga', 'hrga.announcement.delete'),
    ('hrga', 'hrga.people.view'),
    ('hrga', 'hrga.people.edit'),
    ('hrga', 'hrga.public_request_links.view'),
    ('hrga', 'hrga.public_request_links.edit'),
    ('hrga', 'hrga.benefits.view'),
    ('leader', 'dashboard.home.view'),
    ('leader', 'myarklife.view'),
    ('warehouse_leader', 'dashboard.home.view'),
    ('warehouse_leader', 'myarklife.view'),
    ('warehouse_leader', 'storage.overview.view'),
    ('warehouse_leader', 'storage.search.view'),
    ('warehouse_leader', 'storage.location.view'),
    ('warehouse_leader', 'inbound.overview.view'),
    ('warehouse_leader', 'inbound.detail.view'),
    ('warehouse_leader', 'packing.overview.view'),
    ('warehouse_leader', 'qc.summary.view'),
    ('packing_coordinator', 'dashboard.home.view'),
    ('packing_coordinator', 'myarklife.view'),
    ('packing_coordinator', 'packing.overview.view'),
    ('packing_coordinator', 'packing.receiving.view'),
    ('packing_coordinator', 'packing.receiving.add'),
    ('packing_coordinator', 'packing.receiving.edit'),
    ('packing_coordinator', 'packing.size_breakdown.view'),
    ('packing_coordinator', 'packing.size_breakdown.edit'),
    ('packing_staff', 'dashboard.home.view'),
    ('packing_staff', 'myarklife.view'),
    ('packing_staff', 'packing.overview.view'),
    ('packing_staff', 'packing.receiving.view'),
    ('packing_staff', 'packing.receiving.add'),
    ('packing_staff', 'packing.receiving.edit'),
    ('packing_staff', 'packing.size_breakdown.view'),
    ('packing_staff', 'packing.size_breakdown.edit'),
    ('qc_coordinator', 'dashboard.home.view'),
    ('qc_coordinator', 'myarklife.view'),
    ('qc_coordinator', 'qc.summary.view'),
    ('qc_coordinator', 'qc.receiving.view'),
    ('qc_coordinator', 'qc.receiving.add'),
    ('qc_coordinator', 'qc.receiving.edit'),
    ('qc_coordinator', 'qc.receiving.delete'),
    ('qc_coordinator', 'qc.grading_task.view'),
    ('qc_coordinator', 'qc.grading_task.add'),
    ('qc_coordinator', 'qc.grading_task.edit'),
    ('qc_coordinator', 'qc.confirmation.view'),
    ('qc_coordinator', 'qc.confirmation.add'),
    ('qc_coordinator', 'qc.confirmation.edit'),
    ('qc_coordinator', 'qc.retur_report.view'),
    ('qc_staff', 'dashboard.home.view'),
    ('qc_staff', 'myarklife.view'),
    ('qc_staff', 'qc.receiving.view'),
    ('qc_staff', 'qc.receiving.add'),
    ('qc_staff', 'qc.receiving.edit'),
    ('qc_staff', 'qc.grading_task.view'),
    ('qc_staff', 'qc.grading_task.add'),
    ('qc_staff', 'qc.grading_task.edit'),
    ('qc_staff', 'qc.confirmation.view'),
    ('qc_staff', 'qc.confirmation.add'),
    ('qc_staff', 'qc.confirmation.edit'),
    ('qc_staff', 'qc.retur_report.view'),
    ('qc_inspector', 'dashboard.home.view'),
    ('qc_inspector', 'myarklife.view'),
    ('qc_inspector', 'qc.grading_task.view'),
    ('qc_inspector', 'qc.grading_task.add'),
    ('qc_inspector', 'qc.grading_task.edit'),
    ('storage_coordinator', 'dashboard.home.view'),
    ('storage_coordinator', 'myarklife.view'),
    ('storage_coordinator', 'storage.overview.view'),
    ('storage_coordinator', 'storage.search.view'),
    ('storage_coordinator', 'storage.registry.view'),
    ('storage_coordinator', 'storage.registry.add'),
    ('storage_coordinator', 'storage.registry.edit'),
    ('storage_coordinator', 'storage.registry.delete'),
    ('storage_coordinator', 'storage.location.view'),
    ('storage_coordinator', 'storage.restock_instruction.view'),
    ('storage_coordinator', 'storage.restock_submit.view'),
    ('storage_coordinator', 'storage.restock_submit.add'),
    ('storage_coordinator', 'storage.restock_submit.edit'),
    ('storage_coordinator', 'storage.restock_picker.view'),
    ('storage_coordinator', 'storage.restock_picker.edit'),
    ('storage_staff', 'dashboard.home.view'),
    ('storage_staff', 'myarklife.view'),
    ('storage_staff', 'storage.overview.view'),
    ('storage_staff', 'storage.search.view'),
    ('storage_staff', 'storage.registry.view'),
    ('storage_staff', 'storage.registry.add'),
    ('storage_staff', 'storage.registry.edit'),
    ('storage_staff', 'storage.location.view'),
    ('storage_staff', 'storage.restock_instruction.view'),
    ('storage_staff', 'storage.restock_submit.view'),
    ('storage_staff', 'storage.restock_submit.add'),
    ('storage_staff', 'storage.restock_submit.edit'),
    ('storage_staff', 'storage.restock_picker.view'),
    ('storage_staff', 'storage.restock_picker.edit'),
    ('inbound_coordinator', 'dashboard.home.view'),
    ('inbound_coordinator', 'myarklife.view'),
    ('inbound_coordinator', 'inbound.overview.view'),
    ('inbound_coordinator', 'inbound.new.view'),
    ('inbound_coordinator', 'inbound.new.add'),
    ('inbound_coordinator', 'inbound.detail.view'),
    ('inbound_coordinator', 'inbound.edit.view'),
    ('inbound_coordinator', 'inbound.edit.edit'),
    ('inbound_coordinator', 'inbound.unload.view'),
    ('inbound_coordinator', 'inbound.unload.edit'),
    ('inbound_coordinator', 'inbound.receiving.view'),
    ('inbound_coordinator', 'inbound.receiving.edit'),
    ('inbound_coordinator', 'inbound.qc.view'),
    ('inbound_staff', 'dashboard.home.view'),
    ('inbound_staff', 'myarklife.view'),
    ('inbound_staff', 'inbound.overview.view'),
    ('inbound_staff', 'inbound.new.view'),
    ('inbound_staff', 'inbound.new.add'),
    ('inbound_staff', 'inbound.detail.view'),
    ('inbound_staff', 'inbound.edit.view'),
    ('inbound_staff', 'inbound.edit.edit'),
    ('inbound_staff', 'inbound.unload.view'),
    ('inbound_staff', 'inbound.unload.edit'),
    ('inbound_staff', 'inbound.receiving.view'),
    ('inbound_staff', 'inbound.receiving.edit'),
    ('inbound_staff', 'inbound.qc.view'),
    ('arkline_staff', 'dashboard.home.view'),
    ('arkline_staff', 'myarklife.view'),
    ('arkline_staff', 'arkline.overview.view'),
    ('arkline_staff', 'arkline.progress_snapshot.view'),
    ('arkline_staff', 'arkline.progress_snapshot.products.view'),
    ('arkline_merchandiser', 'dashboard.home.view'),
    ('arkline_merchandiser', 'myarklife.view'),
    ('arkline_merchandiser', 'arkline.overview.view'),
    ('arkline_merchandiser', 'arkline.directory.view'),
    ('arkline_merchandiser', 'arkline.directory.products.view'),
    ('arkline_merchandiser', 'arkline.directory.products.add'),
    ('arkline_merchandiser', 'arkline.directory.products.edit'),
    ('arkline_merchandiser', 'arkline.directory.bom.view'),
    ('arkline_merchandiser', 'arkline.directory.bom.add'),
    ('arkline_merchandiser', 'arkline.directory.bom.edit'),
    ('arkline_merchandiser', 'arkline.directory.materials.view'),
    ('arkline_merchandiser', 'arkline.directory.materials.add'),
    ('arkline_merchandiser', 'arkline.directory.materials.edit'),
    ('arkline_merchandiser', 'arkline.progress_snapshot.view'),
    ('arkline_merchandiser', 'arkline.progress_snapshot.kanban.view'),
    ('arkline_merchandiser', 'arkline.progress_snapshot.kanban.add'),
    ('arkline_merchandiser', 'arkline.progress_snapshot.kanban.edit'),
    ('arkline_merchandiser', 'arkline.progress_snapshot.calendar.view'),
    ('arkline_merchandiser', 'arkline.progress_snapshot.products.view'),
    ('arkline_merchandiser', 'arkline.production_planning.view'),
    ('arkline_merchandiser', 'arkline.production_orders.view'),
    ('arkline_merchandiser', 'arkline.production_orders.add'),
    ('arkline_merchandiser', 'arkline.production_orders.edit'),
    ('arkline_merchandiser', 'arkline.production_orders.delete'),
    ('arkline_merchandiser', 'arkline.production_orders.print'),
    ('arkline_merchandiser', 'arkline.material_fulfillment.view'),
    ('arkline_merchandiser', 'arkline.material_fulfillment.add'),
    ('arkline_merchandiser', 'arkline.material_fulfillment.edit'),
    ('arkline_merchandiser', 'arkline.material_fulfillment.delete'),
    ('arkline_merchandiser', 'arkline.financial_management.view'),
    ('arkline_merchandiser', 'arkline.financial_management.payment_submission.view'),
    ('arkline_merchandiser', 'arkline.financial_management.payment_submission.add'),
    ('arkline_merchandiser', 'arkline.financial_management.payment_submission.edit'),
    ('arkline_merchandiser', 'arkline.financial_management.reporting.view'),
    ('arkline_host', 'dashboard.home.view'),
    ('arkline_host', 'myarklife.view'),
    ('arkline_host', 'arkline.overview.view'),
    ('arkline_host', 'arkline.directory.view'),
    ('arkline_host', 'arkline.directory.products.view'),
    ('arkline_host', 'arkline.directory.bom.view'),
    ('arkline_host', 'arkline.directory.materials.view'),
    ('arkline_host', 'arkline.progress_snapshot.view'),
    ('arkline_host', 'arkline.progress_snapshot.kanban.view'),
    ('arkline_host', 'arkline.progress_snapshot.calendar.view'),
    ('arkline_host', 'arkline.progress_snapshot.products.view')
) as seeded(role, permission_code)
on conflict do nothing;

create or replace function public.reimbursement_is_hrga_approver()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.dir_user_profiles profile
    where profile.authenticated_id = auth.uid()
      and profile.role = 'hrga'
  );
$$;

commit;
