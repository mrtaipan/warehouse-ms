create extension if not exists pgcrypto;

create table if not exists public.arkline_po_revisions (
  id uuid primary key default gen_random_uuid(),
  po_id text not null,
  revision_no integer not null,
  revision_type text not null default 'PRODUCTION_PLANNING',
  change_summary text not null,
  change_notes text null,
  before_snapshot jsonb not null default '{}'::jsonb,
  after_snapshot jsonb not null default '{}'::jsonb,
  revised_by text null,
  revised_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint arkline_po_revisions_po_id_fkey
    foreign key (po_id)
    references public.arkline_pos(po_id)
    on update cascade
    on delete cascade,
  constraint arkline_po_revisions_revision_no_check
    check (revision_no > 0),
  constraint arkline_po_revisions_po_revision_key
    unique (po_id, revision_no)
);

create index if not exists arkline_po_revisions_po_id_idx
  on public.arkline_po_revisions (po_id);

create index if not exists arkline_po_revisions_revised_at_idx
  on public.arkline_po_revisions (revised_at desc);

alter table public.arkline_po_revisions enable row level security;

grant select, insert, update, delete on public.arkline_po_revisions to authenticated;

drop policy if exists arkline_po_revisions_authenticated_select on public.arkline_po_revisions;
drop policy if exists arkline_po_revisions_authenticated_insert on public.arkline_po_revisions;
drop policy if exists arkline_po_revisions_authenticated_update on public.arkline_po_revisions;
drop policy if exists arkline_po_revisions_authenticated_delete on public.arkline_po_revisions;

create policy arkline_po_revisions_authenticated_select
on public.arkline_po_revisions
for select
to authenticated
using (true);

create policy arkline_po_revisions_authenticated_insert
on public.arkline_po_revisions
for insert
to authenticated
with check (true);

create policy arkline_po_revisions_authenticated_update
on public.arkline_po_revisions
for update
to authenticated
using (true)
with check (true);

create policy arkline_po_revisions_authenticated_delete
on public.arkline_po_revisions
for delete
to authenticated
using (true);
