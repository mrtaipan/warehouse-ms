begin;

alter table public.pl_receiving
  add column if not exists received_with_names jsonb not null default '[]'::jsonb;

alter table public.pl_receiving
  drop constraint if exists pl_receiving_received_with_names_array_check;

alter table public.pl_receiving
  add constraint pl_receiving_received_with_names_array_check
  check (jsonb_typeof(received_with_names) = 'array');

comment on column public.pl_receiving.received_with_names is
  'Optional list of packing staff names who received the QC Confirm koli together.';

commit;
