alter table public.arkline_po_material_ordered
  add column if not exists finance_resolved boolean not null default false,
  add column if not exists finance_resolved_at timestamptz,
  add column if not exists finance_resolved_by text,
  add column if not exists finance_resolution_notes text;

comment on column public.arkline_po_material_ordered.finance_resolution_notes is
  'Required explanation when an outstanding material PO is manually marked resolved.';
