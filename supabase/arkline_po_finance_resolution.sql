alter table public.arkline_pos
  add column if not exists finance_resolved boolean not null default false,
  add column if not exists finance_resolved_at timestamptz null,
  add column if not exists finance_resolved_by text null,
  add column if not exists finance_resolution_notes text null;

comment on column public.arkline_pos.finance_resolved is
  'Manual finance resolution flag. Does not change calculated due, paid, or outstanding values.';

comment on column public.arkline_pos.finance_resolution_notes is
  'Reason or supporting note for manually resolving the finance item.';
