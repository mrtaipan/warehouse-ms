alter table public.pl_packing_items
  add column if not exists release_status text;

alter table public.pl_packing_items
  alter column release_status set default 'draft';

update public.pl_packing_items
set release_status = 'draft'
where release_status is null;

alter table public.pl_packing_items
  alter column release_status set not null;

alter table public.pl_packing_items
  add column if not exists released_at timestamp with time zone;

alter table public.pl_packing_items
  add column if not exists released_by text;

alter table public.pl_packing_items
  add column if not exists photo_queue_status text;

alter table public.pl_packing_items
  alter column photo_queue_status set default 'none';

update public.pl_packing_items
set photo_queue_status = 'none'
where photo_queue_status is null;

alter table public.pl_packing_items
  alter column photo_queue_status set not null;

alter table public.pl_packing_items
  drop column if exists photo_queue_added_at;

alter table public.pl_packing_items
  drop column if exists photo_queue_added_by;

alter table public.pl_packing_items
  add column if not exists photo_queue_submitted_at timestamp with time zone;

alter table public.pl_packing_items
  add column if not exists photo_queue_submitted_by text;

alter table public.pl_packing_items
  add column if not exists model_photoshoot_done boolean;

alter table public.pl_packing_items
  alter column model_photoshoot_done set default false;

update public.pl_packing_items
set model_photoshoot_done = false
where model_photoshoot_done is null;

alter table public.pl_packing_items
  alter column model_photoshoot_done set not null;

alter table public.pl_packing_items
  add column if not exists model_photoshoot_done_at timestamp with time zone;

alter table public.pl_packing_items
  add column if not exists model_photoshoot_done_by text;

alter table public.pl_packing_items
  add column if not exists teaser_photoshoot_done boolean;

alter table public.pl_packing_items
  alter column teaser_photoshoot_done set default false;

update public.pl_packing_items
set teaser_photoshoot_done = false
where teaser_photoshoot_done is null;

alter table public.pl_packing_items
  alter column teaser_photoshoot_done set not null;

alter table public.pl_packing_items
  add column if not exists teaser_photoshoot_done_at timestamp with time zone;

alter table public.pl_packing_items
  add column if not exists teaser_photoshoot_done_by text;

alter table public.pl_packing_items
  drop constraint if exists pl_packing_items_release_status_check;

alter table public.pl_packing_items
  add constraint pl_packing_items_release_status_check
  check (release_status in ('draft', 'released'));

alter table public.pl_packing_items
  drop constraint if exists pl_packing_items_photo_queue_status_check;

alter table public.pl_packing_items
  add constraint pl_packing_items_photo_queue_status_check
  check (photo_queue_status in ('none', 'draft', 'queued'));

create index if not exists pl_packing_items_release_status_idx
  on public.pl_packing_items (release_status, inbound_id, product_model_variant_id);

create index if not exists pl_packing_items_photo_queue_status_idx
  on public.pl_packing_items (photo_queue_status, inbound_id, product_model_variant_id);

create index if not exists pl_packing_items_photo_workflow_idx
  on public.pl_packing_items (photo_queue_status, model_photoshoot_done, teaser_photoshoot_done);
