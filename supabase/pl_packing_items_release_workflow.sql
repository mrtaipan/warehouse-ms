begin;

alter table public.pl_packing_items
  add column if not exists release_status text,
  add column if not exists released_at timestamp with time zone,
  add column if not exists released_by text;

alter table public.pl_packing_items
  alter column release_status set default 'draft';

update public.pl_packing_items
set release_status = 'draft'
where release_status is null;

alter table public.pl_packing_items
  alter column release_status set not null;

alter table public.pl_packing_items
  drop constraint if exists pl_packing_items_release_status_check;

alter table public.pl_packing_items
  add constraint pl_packing_items_release_status_check
  check (release_status in ('draft', 'released'));

drop index if exists public.pl_packing_items_photo_queue_status_idx;
drop index if exists public.pl_packing_items_photo_workflow_idx;

alter table public.pl_packing_items
  drop constraint if exists pl_packing_items_photo_queue_status_check;

alter table public.pl_packing_items
  drop column if exists photo_queue_status,
  drop column if exists photo_queue_submitted_at,
  drop column if exists photo_queue_submitted_by,
  drop column if exists release_count,
  drop column if exists release_history;

create index if not exists pl_packing_items_release_status_idx
  on public.pl_packing_items (release_status, inbound_id, product_model_variant_id);

commit;
