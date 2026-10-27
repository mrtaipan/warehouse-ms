-- Keep confirmed Re-QC Grade A in reqc_results until Storage Queue stores it.
alter table public.reqc_results
  drop constraint if exists reqc_results_status_check;

alter table public.reqc_results
  add constraint reqc_results_status_check
  check (status in ('PENDING_REVIEW', 'STORAGE_QUEUE', 'STORED', 'SHELVING_QUEUE', 'REJECTION_STORAGE'));

alter table public.warehouse_storage
  add column if not exists reqc_result_id uuid null references public.reqc_results(id) on delete restrict;

create unique index if not exists warehouse_storage_reqc_result_uidx
  on public.warehouse_storage (reqc_result_id)
  where reqc_result_id is not null;

drop policy if exists reqc_results_authenticated_update on public.reqc_results;
create policy reqc_results_authenticated_update on public.reqc_results
  for update to authenticated
  using (
    public.reqc_has_permission('qc.confirmation.edit')
    or (status = 'PENDING_REVIEW' and public.reqc_has_permission('qc.grading_task.edit'))
    or (status = 'STORAGE_QUEUE' and public.reqc_has_permission('storage.location.edit'))
  )
  with check (
    public.reqc_has_permission('qc.confirmation.edit')
    or (status = 'PENDING_REVIEW' and public.reqc_has_permission('qc.grading_task.edit'))
    or (status = 'STORED' and public.reqc_has_permission('storage.location.edit'))
  );

create or replace function public.confirm_reqc_grade_a_to_storage(
  p_result_id uuid,
  p_confirmed_by text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result_row public.reqc_results%rowtype;
begin
  if not public.reqc_has_permission('qc.confirmation.edit') then
    raise exception 'Not authorized to verify Re-QC results';
  end if;

  select * into result_row
  from public.reqc_results
  where id = p_result_id
  for update;

  if result_row.id is null or result_row.grade <> 'A' then
    raise exception 'Only a Re-QC Grade A result can be confirmed to Storage Queue';
  end if;
  if result_row.status <> 'PENDING_REVIEW' then
    raise exception 'Re-QC result has already been reviewed';
  end if;

  update public.reqc_results
  set status = 'STORAGE_QUEUE', reviewed_by = p_confirmed_by,
      reviewed_at = now(), updated_at = now()
  where id = result_row.id;

  return result_row.id;
end;
$$;

revoke execute on function public.confirm_reqc_grade_a_to_shelving(uuid, text) from public, anon, authenticated;
revoke execute on function public.confirm_reqc_grade_a_to_storage(uuid, text) from public, anon;
grant execute on function public.confirm_reqc_grade_a_to_storage(uuid, text) to authenticated;

create or replace function public.store_reqc_grade_a_results(
  p_result_ids uuid[],
  p_rack_location_id bigint,
  p_stored_by text default null,
  p_notes text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result_row public.reqc_results%rowtype;
  queue_row public.reqc_queue%rowtype;
  location_row public.dir_rack_locations%rowtype;
  result_id uuid;
  stored_count integer := 0;
begin
  if not public.reqc_has_permission('storage.location.edit') then
    raise exception 'Not authorized to store Re-QC results';
  end if;
  if coalesce(cardinality(p_result_ids), 0) = 0 then
    raise exception 'Select at least one Re-QC Grade A result';
  end if;
  if (select count(distinct id) from unnest(p_result_ids) as selected(id)) <> cardinality(p_result_ids) then
    raise exception 'Duplicate Re-QC results were selected';
  end if;

  select * into location_row
  from public.dir_rack_locations
  where id = p_rack_location_id;
  if location_row.id is null or upper(coalesce(location_row.location_type, '')) <> 'PALLET' then
    raise exception 'Choose a pallet storage location';
  end if;

  for result_id in select id from unnest(p_result_ids) as selected(id) order by id loop
    select * into result_row
    from public.reqc_results
    where id = result_id
    for update;
    if result_row.id is null or result_row.grade <> 'A' or result_row.status <> 'STORAGE_QUEUE' then
      raise exception 'Re-QC Grade A result % is not waiting in Storage Queue', result_id;
    end if;

    select * into queue_row
    from public.reqc_queue
    where id = result_row.reqc_queue_id;
    if queue_row.id is null or upper(coalesce(queue_row.group_code, '')) <> upper(coalesce(location_row.group_code, '')) then
      raise exception 'Re-QC result % does not match the selected storage group', result_id;
    end if;

    insert into public.warehouse_storage (
      rack_location_id, sku_id, source_variant_code, item_name, size,
      category_id, brand_code, qty, notes, updated_by, reqc_result_id
    ) values (
      location_row.id, queue_row.sku_id, queue_row.source_variant_code,
      queue_row.item_name, queue_row.size, queue_row.category_id,
      queue_row.brand_code, result_row.qty,
      nullif(trim(coalesce(p_notes, '')), ''),
      nullif(trim(coalesce(p_stored_by, '')), ''), result_row.id
    );

    update public.reqc_results
    set status = 'STORED', updated_at = now()
    where id = result_row.id;
    stored_count := stored_count + 1;
  end loop;

  return stored_count;
end;
$$;

revoke execute on function public.store_reqc_grade_a_results(uuid[], bigint, text, text) from public, anon;
grant execute on function public.store_reqc_grade_a_results(uuid[], bigint, text, text) to authenticated;
