alter table public.pl_packing_items
  add column if not exists storage_status text;

alter table public.pl_packing_items
  alter column storage_status set default 'queued';

update public.pl_packing_items
set storage_status = 'stored'
where storage_status is null;

alter table public.pl_packing_items
  alter column storage_status set not null;

alter table public.pl_packing_items
  drop constraint if exists pl_packing_items_storage_status_check;

alter table public.pl_packing_items
  add constraint pl_packing_items_storage_status_check
  check (storage_status in ('queued', 'stored'));

create index if not exists pl_packing_items_storage_status_idx
  on public.pl_packing_items (storage_status, inbound_id, koli_sequence);
