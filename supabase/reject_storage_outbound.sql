-- Run after warehouse_reject_storage.sql and arkline_qc_rejection_storage.sql.
-- The source rows retain their received quantity; available quantity is received minus released.
create table if not exists public.warehouse_reject_storage_outbounds (
  id uuid primary key default gen_random_uuid(),
  regular_reject_id bigint null references public.warehouse_reject_storage(id) on delete restrict,
  arkline_line_id uuid null references public.arkline_qc_rejection_storage_lines(id) on delete restrict,
  qty integer not null check (qty > 0),
  reason text not null check (length(btrim(reason)) > 0),
  destination text null,
  released_by text not null,
  released_at timestamptz not null default now(),
  constraint warehouse_reject_storage_outbounds_one_source_check
    check (num_nonnulls(regular_reject_id, arkline_line_id) = 1)
);

create index if not exists warehouse_reject_storage_outbounds_regular_idx
  on public.warehouse_reject_storage_outbounds (regular_reject_id) where regular_reject_id is not null;
create index if not exists warehouse_reject_storage_outbounds_arkline_idx
  on public.warehouse_reject_storage_outbounds (arkline_line_id) where arkline_line_id is not null;
create index if not exists warehouse_reject_storage_outbounds_date_idx
  on public.warehouse_reject_storage_outbounds (released_at desc);

alter table public.warehouse_reject_storage_outbounds enable row level security;
revoke all on public.warehouse_reject_storage_outbounds from public, anon, authenticated;
grant select on public.warehouse_reject_storage_outbounds to authenticated;
drop policy if exists warehouse_reject_storage_outbounds_read on public.warehouse_reject_storage_outbounds;
create policy warehouse_reject_storage_outbounds_read
  on public.warehouse_reject_storage_outbounds for select to authenticated
  using ((select auth.uid()) is not null);

create or replace function public.release_reject_storage_item(
  p_source_type text,
  p_source_id text,
  p_qty integer,
  p_reason text,
  p_destination text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regular_id bigint;
  v_arkline_id uuid;
  v_received integer;
  v_released integer;
  v_status text;
  v_outbound_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (
    select 1
    from public.dir_user_profiles profile
    left join public.dir_user_roles role_map on role_map.role = profile.role
    where profile.authenticated_id = (select auth.uid())
      and (
        profile.role in ('admin', 'qc_coordinator', 'storage_coordinator')
        or role_map.permission_code in ('storage.location.add', 'storage.location.edit')
      )
  ) then
    raise exception 'Not allowed to release reject storage items';
  end if;

  if p_qty is null or p_qty < 1 then
    raise exception 'Release quantity must be positive';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A release reason is required';
  end if;

  if p_source_type = 'REGULAR' then
    v_regular_id := p_source_id::bigint;
    select qty, status into v_received, v_status
    from public.warehouse_reject_storage
    where id = v_regular_id
    for update;
    if not found or v_status <> 'POSTED' then
      raise exception 'Posted regular reject item was not found';
    end if;
    select coalesce(sum(qty), 0) into v_released
    from public.warehouse_reject_storage_outbounds
    where regular_reject_id = v_regular_id;
  elsif p_source_type = 'ARKLINE' then
    v_arkline_id := p_source_id::uuid;
    select line.qty, batch.status into v_received, v_status
    from public.arkline_qc_rejection_storage_lines line
    join public.arkline_qc_rejection_storage_batches batch on batch.id = line.storage_batch_id
    where line.id = v_arkline_id
    for update of line;
    if not found or v_status <> 'STORED' then
      raise exception 'Stored Arkline reject line was not found';
    end if;
    select coalesce(sum(qty), 0) into v_released
    from public.warehouse_reject_storage_outbounds
    where arkline_line_id = v_arkline_id;
  else
    raise exception 'Unknown reject storage source';
  end if;

  if p_qty > v_received - v_released then
    raise exception 'Only % unit(s) remain in this reject item', greatest(v_received - v_released, 0);
  end if;

  insert into public.warehouse_reject_storage_outbounds
    (regular_reject_id, arkline_line_id, qty, reason, destination, released_by)
  values
    (v_regular_id, v_arkline_id, p_qty, btrim(p_reason), nullif(btrim(p_destination), ''),
     coalesce(nullif((select auth.jwt()) ->> 'email', ''), (select auth.uid())::text))
  returning id into v_outbound_id;

  return v_outbound_id;
end;
$$;

revoke all on function public.release_reject_storage_item(text, text, integer, text, text) from public, anon;
grant execute on function public.release_reject_storage_item(text, text, integer, text, text) to authenticated;

-- A displayed product/size can comprise multiple source rows. The whole selection
-- runs in one transaction, so a failed allocation cannot leave a partial release.
create or replace function public.release_reject_storage_selection(
  p_source_type text,
  p_source_ids text[],
  p_qty integer,
  p_reason text,
  p_destination text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source_id text;
  v_available integer;
  v_left integer := p_qty;
  v_take integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;
  if p_source_type not in ('REGULAR', 'ARKLINE') or p_source_ids is null or cardinality(p_source_ids) = 0 then
    raise exception 'Choose a reject storage item';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'Release quantity must be positive';
  end if;

  for v_source_id in
    select distinct input.source_id
    from unnest(p_source_ids) as input(source_id)
    order by input.source_id
  loop
    if p_source_type = 'REGULAR' then
      select source.qty - coalesce((
        select sum(outbound.qty)
        from public.warehouse_reject_storage_outbounds outbound
        where outbound.regular_reject_id = source.id
      ), 0) into v_available
      from public.warehouse_reject_storage source
      where source.id = v_source_id::bigint and source.status = 'POSTED';
    else
      select source.qty - coalesce((
        select sum(outbound.qty)
        from public.warehouse_reject_storage_outbounds outbound
        where outbound.arkline_line_id = source.id
      ), 0) into v_available
      from public.arkline_qc_rejection_storage_lines source
      join public.arkline_qc_rejection_storage_batches batch on batch.id = source.storage_batch_id
      where source.id = v_source_id::uuid and batch.status = 'STORED';
    end if;

    v_take := least(v_left, greatest(coalesce(v_available, 0), 0));
    if v_take > 0 then
      perform public.release_reject_storage_item(p_source_type, v_source_id, v_take, p_reason, p_destination);
      v_left := v_left - v_take;
    end if;
    exit when v_left = 0;
  end loop;

  if v_left > 0 then
    raise exception 'Only % unit(s) remain in the selected product and size', p_qty - v_left;
  end if;
  return p_qty;
end;
$$;

revoke all on function public.release_reject_storage_selection(text, text[], integer, text, text) from public, anon;
grant execute on function public.release_reject_storage_selection(text, text[], integer, text, text) to authenticated;
