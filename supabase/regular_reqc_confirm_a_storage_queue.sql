-- Route bulk Grade A reviews to Storage Queue and move unprocessed legacy rows.
create or replace function public.review_reqc_results(
  p_result_ids uuid[], p_action text, p_koli_number text default null,
  p_reject_note text default null, p_confirmed_by text default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  result_id uuid;
  target_koli text;
  storage_id bigint;
  reviewed_count integer := 0;
begin
  if not public.reqc_has_permission('qc.confirmation.edit') then
    raise exception 'Not authorized to verify Re-QC results';
  end if;
  if coalesce(cardinality(p_result_ids), 0) = 0 then raise exception 'Select results first'; end if;
  if (select count(distinct id) from unnest(p_result_ids) as selected(id)) <> cardinality(p_result_ids) then
    raise exception 'Duplicate results were selected';
  end if;
  if p_action not in ('CONFIRM_A', 'STORE_REJECT') then raise exception 'Invalid review action'; end if;
  if p_action = 'STORE_REJECT' then
    if nullif(trim(coalesce(p_reject_note, '')), '') is null then raise exception 'Enter a reject note'; end if;
    target_koli := nullif(trim(coalesce(p_koli_number, '')), '');
  end if;
  for result_id in select id from unnest(p_result_ids) as selected(id) order by id loop
    if p_action = 'CONFIRM_A' then
      perform public.confirm_reqc_grade_a_to_storage(result_id, p_confirmed_by);
    else
      storage_id := public.confirm_reqc_reject_to_storage_with_note(result_id, target_koli, p_reject_note, p_confirmed_by);
      if target_koli is null then
        select koli_number into target_koli from public.warehouse_reject_storage where id = storage_id;
      end if;
    end if;
    reviewed_count := reviewed_count + 1;
  end loop;
  return reviewed_count;
end;
$$;

do $$
declare
  result_row record;
  shelf_row record;
begin
  for result_row in
    select id from public.reqc_results
    where grade = 'A' and status = 'SHELVING_QUEUE'
    for update
  loop
    select id, status, stored_at, target_rack_location_id into shelf_row
    from public.warehouse_shelving_queue
    where reqc_result_id = result_row.id
    for update;
    if shelf_row.id is null or shelf_row.status <> 'WAITING_SHELVING'
       or shelf_row.stored_at is not null or shelf_row.target_rack_location_id is not null then
      raise exception 'Re-QC result % has a processed or missing Shelving Queue row; reroute manually', result_row.id;
    end if;
    update public.warehouse_shelving_queue
    set status = 'CANCELLED',
        notes = concat_ws(E'\n', nullif(notes, ''), 'Rerouted to Re-QC Storage Queue')
    where id = shelf_row.id;
    update public.reqc_results
    set status = 'STORAGE_QUEUE', updated_at = now()
    where id = result_row.id;
  end loop;
end;
$$;
