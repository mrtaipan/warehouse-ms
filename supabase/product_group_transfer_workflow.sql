begin;

create table if not exists public.product_group_transfer_events (
  id bigserial primary key,
  source_pl_packing_item_id bigint null references public.pl_packing_items(id) on delete restrict,
  product_bundle_component_id bigint null references public.product_bundle_components(id) on delete restrict,
  source_type text not null,
  target_type text not null,
  transfer_qty integer not null,
  source_qty_before integer not null,
  source_qty_after integer not null,
  created_by text null,
  created_at timestamptz not null default now(),
  constraint product_group_transfer_events_type_check
    check (source_type in ('MOB', 'OI') and target_type in ('MOB', 'OI') and source_type <> target_type),
  constraint product_group_transfer_events_source_ref_check
    check ((source_pl_packing_item_id is not null) <> (product_bundle_component_id is not null)),
  constraint product_group_transfer_events_qty_check
    check (transfer_qty > 0 and source_qty_before >= transfer_qty and source_qty_after >= 0)
);

create index if not exists product_group_transfer_events_created_at_idx
  on public.product_group_transfer_events (created_at desc);

create index if not exists product_group_transfer_events_source_idx
  on public.product_group_transfer_events (source_pl_packing_item_id);

drop index if exists public.product_group_transfer_events_target_idx;

alter table public.product_group_transfer_events
  drop column if exists target_pl_packing_item_id;

alter table public.product_group_transfer_events
  add column if not exists product_bundle_component_id bigint;

create index if not exists product_group_transfer_events_bundle_component_idx
  on public.product_group_transfer_events (product_bundle_component_id, created_at desc);

alter table public.product_group_transfer_events
  alter column source_pl_packing_item_id drop not null;

alter table public.product_group_transfer_events
  drop constraint if exists product_group_transfer_events_source_ref_check;

alter table public.product_group_transfer_events
  add constraint product_group_transfer_events_source_ref_check
  check ((source_pl_packing_item_id is not null) <> (product_bundle_component_id is not null));

alter table public.product_group_transfer_events
  drop constraint if exists product_group_transfer_events_source_pl_packing_item_id_fkey;

alter table public.product_group_transfer_events
  add constraint product_group_transfer_events_source_pl_packing_item_id_fkey
  foreign key (source_pl_packing_item_id)
  references public.pl_packing_items(id)
  on delete restrict;

alter table public.product_group_transfer_events
  drop constraint if exists product_group_transfer_events_product_bundle_component_id_fkey;

alter table public.product_group_transfer_events
  add constraint product_group_transfer_events_product_bundle_component_id_fkey
  foreign key (product_bundle_component_id)
  references public.product_bundle_components(id)
  on delete restrict;

alter table public.product_group_transfer_events enable row level security;

grant usage on schema public to authenticated;
grant select, insert on public.product_group_transfer_events to authenticated;
grant usage, select on sequence public.product_group_transfer_events_id_seq to authenticated;

drop policy if exists product_group_transfer_events_authenticated_select
  on public.product_group_transfer_events;
drop policy if exists product_group_transfer_events_authenticated_insert
  on public.product_group_transfer_events;

create policy product_group_transfer_events_authenticated_select
on public.product_group_transfer_events
for select
to authenticated
using (true);

create policy product_group_transfer_events_authenticated_insert
on public.product_group_transfer_events
for insert
to authenticated
with check (true);

drop function if exists public.transfer_pl_packing_item_group(bigint, integer, text, text);

create or replace function public.transfer_pl_packing_item_group(
  p_row_id bigint,
  p_source_type text,
  p_transfer_qty integer,
  p_target_type text,
  p_actor text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_source public.pl_packing_items%rowtype;
  v_source_type text;
  v_target_type text;
  v_transfer_qty integer;
  v_base_type text;
  v_source_group_qty integer := 0;
  v_incoming_qty integer := 0;
  v_outgoing_qty integer := 0;
  v_available_qty integer := 0;
  v_event public.product_group_transfer_events%rowtype;
  v_now timestamptz := now();
begin
  v_source_type := upper(trim(coalesce(p_source_type, '')));
  v_target_type := upper(trim(coalesce(p_target_type, '')));
  v_transfer_qty := coalesce(p_transfer_qty, 0);

  if v_source_type not in ('MOB', 'OI') or v_target_type not in ('MOB', 'OI') then
    raise exception 'Source and target groups must be MOB or OI.';
  end if;

  if v_source_type = v_target_type then
    raise exception 'Source and target group cannot be the same.';
  end if;

  if v_transfer_qty <= 0 then
    raise exception 'Transfer quantity must be greater than 0.';
  end if;

  perform pg_advisory_xact_lock(p_row_id);

  select *
    into v_source
  from public.pl_packing_items
  where id = p_row_id
  for update;

  if not found then
    raise exception 'Source PL row % was not found.', p_row_id;
  end if;

  v_base_type := upper(trim(coalesce(v_source.storing_type, '')));

  if v_base_type not in ('MOB', 'OI') then
    raise exception 'Source PL row has an invalid group.';
  end if;

  if v_base_type = v_source_type then
    v_source_group_qty := coalesce(v_source.qty, 0);
  end if;

  select
    coalesce(sum(case when target_type = v_source_type then transfer_qty else 0 end), 0),
    coalesce(sum(case when source_type = v_source_type then transfer_qty else 0 end), 0)
    into v_incoming_qty, v_outgoing_qty
  from public.product_group_transfer_events
  where source_pl_packing_item_id = v_source.id;

  v_available_qty := v_source_group_qty + v_incoming_qty - v_outgoing_qty;

  if v_transfer_qty > v_available_qty then
    raise exception 'Transfer quantity cannot be greater than effective % quantity (%).', v_source_type, v_available_qty;
  end if;

  insert into public.product_group_transfer_events (
    source_pl_packing_item_id,
    source_type,
    target_type,
    transfer_qty,
    source_qty_before,
    source_qty_after,
    created_by,
    created_at
  )
  values (
    v_source.id,
    v_source_type,
    v_target_type,
    v_transfer_qty,
    v_available_qty,
    v_available_qty - v_transfer_qty,
    p_actor,
    v_now
  )
  returning * into v_event;

  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'source_row_id', v_source.id,
    'source_type', v_source_type,
    'target_type', v_target_type,
    'source_qty_before', v_available_qty,
    'source_qty_after', v_available_qty - v_transfer_qty
  );
end;
$$;

grant execute on function public.transfer_pl_packing_item_group(bigint, text, integer, text, text) to authenticated;

create or replace function public.transfer_product_bundle_component_group(
  p_product_bundle_component_id bigint,
  p_source_type text,
  p_transfer_qty integer,
  p_target_type text,
  p_actor text default null
)
returns jsonb
language plpgsql
as $$
declare
  v_component public.product_bundle_components%rowtype;
  v_bundle public.product_bundles%rowtype;
  v_source_type text := upper(trim(coalesce(p_source_type, '')));
  v_target_type text := upper(trim(coalesce(p_target_type, '')));
  v_source_qty_before integer;
  v_base_qty integer;
  v_event public.product_group_transfer_events%rowtype;
begin
  if v_source_type not in ('MOB', 'OI') or v_target_type not in ('MOB', 'OI') or v_source_type = v_target_type then
    raise exception 'Bundle transfer must move between MOB and OI.';
  end if;

  if coalesce(p_transfer_qty, 0) <= 0 then
    raise exception 'Bundle transfer quantity must be greater than 0.';
  end if;

  perform pg_advisory_xact_lock(p_product_bundle_component_id);

  select *
    into v_component
  from public.product_bundle_components
  where id = p_product_bundle_component_id
  for update;

  if not found then
    raise exception 'Bundle component % was not found.', p_product_bundle_component_id;
  end if;

  select *
    into v_bundle
  from public.product_bundles
  where id = v_component.bundle_id;

  v_base_qty := case when upper(trim(coalesce(v_bundle.storing_type, ''))) = v_source_type then coalesce(v_component.allocated_qty, 0) else 0 end;

  select v_base_qty + coalesce(sum(
    case
      when source_type = v_source_type then transfer_qty
      when target_type = v_source_type then -transfer_qty
      else 0
    end
  ), 0)::integer
    into v_source_qty_before
  from public.product_group_transfer_events
  where product_bundle_component_id = v_component.id;

  if p_transfer_qty > v_source_qty_before then
    raise exception 'Transfer quantity cannot be greater than available bundle quantity.';
  end if;

  insert into public.product_group_transfer_events (
    source_pl_packing_item_id,
    product_bundle_component_id,
    source_type,
    target_type,
    transfer_qty,
    source_qty_before,
    source_qty_after,
    created_by
  )
  values (
    null,
    v_component.id,
    v_source_type,
    v_target_type,
    p_transfer_qty,
    v_source_qty_before,
    v_source_qty_before - p_transfer_qty,
    p_actor
  )
  returning * into v_event;

  return jsonb_build_object('event', to_jsonb(v_event));
end;
$$;

grant execute on function public.transfer_product_bundle_component_group(bigint, text, integer, text, text) to authenticated;

comment on table public.product_group_transfer_events is
  'Audit log for Product Directory MOB/OI group transfers.';

comment on function public.transfer_pl_packing_item_group(bigint, text, integer, text, text) is
  'Records a Product Directory MOB/OI group transfer without changing the original Packing List rows.';

comment on function public.transfer_product_bundle_component_group(bigint, text, integer, text, text) is
  'Records a Product Directory MOB/OI group transfer for a bundle component in the shared transfer ledger.';

notify pgrst, 'reload schema';

commit;
