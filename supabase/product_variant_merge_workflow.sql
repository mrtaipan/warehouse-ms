-- Product variant split/merge identity workflow.
-- Merge keeps historical PL/GRN rows unchanged and resolves canonical identity from the variant registry.

begin;

alter table public.dir_product_model_variants
  add column if not exists merged_into_variant_id bigint null,
  add column if not exists merged_at timestamptz null,
  add column if not exists merged_by text null,
  add column if not exists split_at timestamptz null,
  add column if not exists split_by text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'dir_product_model_variants_merged_into_variant_id_fkey'
      and conrelid = 'public.dir_product_model_variants'::regclass
  ) then
    alter table public.dir_product_model_variants
      add constraint dir_product_model_variants_merged_into_variant_id_fkey
      foreign key (merged_into_variant_id)
      references public.dir_product_model_variants(id)
      on delete set null;
  end if;
end $$;

create index if not exists dir_product_model_variants_merged_into_idx
  on public.dir_product_model_variants (merged_into_variant_id);

create table if not exists public.product_variant_identity_events (
  id bigserial primary key,
  event_type text not null check (event_type in ('split', 'merge')),
  source_variant_ids bigint[] not null default '{}',
  target_variant_id bigint null references public.dir_product_model_variants(id) on delete set null,
  created_variant_ids bigint[] not null default '{}',
  affected_pl_packing_item_ids bigint[] not null default '{}',
  affected_pl_size_breakdown_ids bigint[] not null default '{}',
  detail_assignments jsonb not null default '[]'::jsonb,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint product_variant_identity_events_detail_assignments_check
    check (jsonb_typeof(detail_assignments) = 'array')
);

alter table public.product_variant_identity_events
  add column if not exists detail_assignments jsonb;

update public.product_variant_identity_events
set detail_assignments = '[]'::jsonb
where detail_assignments is null;

alter table public.product_variant_identity_events
  alter column detail_assignments set default '[]'::jsonb,
  alter column detail_assignments set not null;

alter table public.product_variant_identity_events
  drop constraint if exists product_variant_identity_events_detail_assignments_check;

alter table public.product_variant_identity_events
  add constraint product_variant_identity_events_detail_assignments_check
  check (jsonb_typeof(detail_assignments) = 'array');

create index if not exists product_variant_identity_events_type_idx
  on public.product_variant_identity_events (event_type, created_at desc);

create index if not exists product_variant_identity_events_target_idx
  on public.product_variant_identity_events (target_variant_id);

create index if not exists product_variant_identity_events_source_variants_idx
  on public.product_variant_identity_events using gin (source_variant_ids);

create index if not exists product_variant_identity_events_created_variants_idx
  on public.product_variant_identity_events using gin (created_variant_ids);

create index if not exists product_variant_identity_events_detail_assignments_idx
  on public.product_variant_identity_events using gin (detail_assignments);

alter table public.product_variant_identity_events enable row level security;

grant usage on schema public to authenticated;
grant select, insert on public.product_variant_identity_events to authenticated;
grant usage, select on sequence public.product_variant_identity_events_id_seq to authenticated;

drop policy if exists product_variant_identity_events_authenticated_select
  on public.product_variant_identity_events;
drop policy if exists product_variant_identity_events_authenticated_insert
  on public.product_variant_identity_events;

create policy product_variant_identity_events_authenticated_select
on public.product_variant_identity_events
for select
to authenticated
using (true);

create policy product_variant_identity_events_authenticated_insert
on public.product_variant_identity_events
for insert
to authenticated
with check (true);

comment on column public.dir_product_model_variants.split_at is
  'Timestamp when this source variant was deactivated by a split.';

comment on column public.dir_product_model_variants.split_by is
  'User display name or email that performed the split.';

comment on column public.product_variant_identity_events.detail_assignments is
  'Immutable split mapping keyed by source_variant_id, inbound_id, and source_detail_seq. Merge events store an empty array.';

-- The legacy public.product_variant_split_assignments table is no longer used.
-- Drop it only after any existing split data has been reconciled into detail_assignments.

commit;
