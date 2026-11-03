-- Apply after regular_reqc_workflow.sql and regular_reqc_reject_note.sql.
-- Batch review keeps each Grade A result's source pallet group in Shelving Queue.
grant execute on function public.confirm_reqc_grade_a_to_shelving(uuid, text) to authenticated;

create or replace function public.review_reqc_results(
  p_result_ids uuid[], p_action text, p_koli_number text default null,
  p_reject_note text default null, p_confirmed_by text default null
) returns integer language plpgsql security invoker set search_path = '' as $$
declare result_id uuid; target_koli text; storage_id bigint; reviewed_count integer := 0;
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
      perform public.confirm_reqc_grade_a_to_shelving(result_id, p_confirmed_by);
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
revoke execute on function public.review_reqc_results(uuid[], text, text, text, text) from public, anon;
grant execute on function public.review_reqc_results(uuid[], text, text, text, text) to authenticated;

create policy reqc_results_shelving_store on public.reqc_results
for update to authenticated
using (status = 'SHELVING_QUEUE' and public.reqc_has_permission('storage.queue.edit'))
with check (status = 'STORED' and public.reqc_has_permission('storage.queue.edit'));

create or replace function public.sync_reqc_result_from_shelving_queue()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.reqc_result_id is not null
     and new.status = 'STORED'
     and old.status is distinct from new.status then
    update public.reqc_results
    set status = 'STORED', updated_at = now()
    where id = new.reqc_result_id and status = 'SHELVING_QUEUE';
  end if;
  return new;
end;
$$;

create trigger reqc_result_shelving_queue_stored
after update of status on public.warehouse_shelving_queue
for each row execute function public.sync_reqc_result_from_shelving_queue();
