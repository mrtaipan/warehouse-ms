-- Keep reviewed results immutable while allowing a fresh pending result for the same grade.
alter table public.reqc_results
  drop constraint if exists reqc_results_qc_item_id_grade_key;

create unique index if not exists reqc_results_pending_qc_item_grade_uidx
  on public.reqc_results (qc_item_id, grade)
  where status = 'PENDING_REVIEW';

drop policy if exists reqc_results_authenticated_insert on public.reqc_results;
create policy reqc_results_authenticated_insert on public.reqc_results
  for insert to authenticated
  with check (
    status = 'PENDING_REVIEW'
    and (public.reqc_has_permission('qc.grading_task.edit')
      or public.reqc_has_permission('qc.confirmation.edit'))
  );

create or replace function public.adjust_reqc_result(
  p_result_id uuid, p_to_grade text, p_qty integer, p_note text, p_created_by text default null
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  source_row public.reqc_results%rowtype;
  pending_target_id uuid;
begin
  if not public.reqc_has_permission('qc.confirmation.edit') then
    raise exception 'Not authorized to adjust Re-QC results';
  end if;
  select * into source_row from public.reqc_results where id = p_result_id;
  if source_row.id is null then
    raise exception 'Re-QC result not found';
  end if;
  perform 1 from public.qc_items where id = source_row.qc_item_id for update;
  select * into source_row from public.reqc_results where id = p_result_id for update;
  if source_row.id is null or source_row.status <> 'PENDING_REVIEW' then
    raise exception 'Only pending Re-QC results can be adjusted';
  end if;
  if p_to_grade not in ('A', 'B', 'C') or p_to_grade = source_row.grade
     or p_qty is null or p_qty < 1 or p_qty > source_row.qty
     or nullif(trim(coalesce(p_note, '')), '') is null then
    raise exception 'Choose another grade, valid quantity, and note';
  end if;

  select id into pending_target_id from public.reqc_results
  where qc_item_id = source_row.qc_item_id
    and grade = p_to_grade
    and status = 'PENDING_REVIEW'
  for update;

  insert into public.reqc_adjustments(reqc_result_id, qc_item_id, from_grade, to_grade, qty, note, created_by)
  values (p_result_id, source_row.qc_item_id, source_row.grade, p_to_grade, p_qty, trim(p_note), p_created_by);

  if p_qty = source_row.qty then
    if pending_target_id is not null then
      update public.reqc_results set qty = qty + p_qty, updated_at = now()
      where id = pending_target_id;
      delete from public.reqc_results where id = p_result_id;
    else
      update public.reqc_results set grade = p_to_grade, updated_at = now()
      where id = p_result_id;
    end if;
  else
    update public.reqc_results set qty = qty - p_qty, updated_at = now()
    where id = p_result_id;
    if pending_target_id is not null then
      update public.reqc_results set qty = qty + p_qty, updated_at = now()
      where id = pending_target_id;
    else
      insert into public.reqc_results(reqc_queue_id, qc_item_id, grade, qty)
      values (source_row.reqc_queue_id, source_row.qc_item_id, p_to_grade, p_qty);
    end if;
  end if;
end;
$$;

-- Replaying a finished QC task must not recreate a result that was already reviewed.
create or replace function public.sync_reqc_results_from_qc_item()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.qc_type <> 'RE_QC' or new.reqc_queue_id is null then return new; end if;
  if new.status = 'done' and not exists (
    select 1 from public.reqc_adjustments where qc_item_id = new.id
  ) then
    insert into public.reqc_results(reqc_queue_id, qc_item_id, grade, qty)
    select new.reqc_queue_id, new.id, grade_row.grade, grade_row.qty
    from (values ('A', new.qty_a), ('B', new.qty_b), ('C', new.qty_c)) as grade_row(grade, qty)
    where grade_row.qty > 0
      and not exists (
        select 1 from public.reqc_results reviewed
        where reviewed.qc_item_id = new.id
          and reviewed.grade = grade_row.grade
          and reviewed.status <> 'PENDING_REVIEW'
      )
    on conflict (qc_item_id, grade) where status = 'PENDING_REVIEW'
    do update set qty = excluded.qty, updated_at = now();
  end if;
  update public.reqc_queue queue_row
  set status = case
    when coalesce((select sum(task.allocated_qty) from public.qc_items task where task.reqc_queue_id = queue_row.id), 0) >= queue_row.qty
     and not exists (select 1 from public.qc_items task where task.reqc_queue_id = queue_row.id and task.status <> 'done') then 'QC_DONE'
    when exists (select 1 from public.qc_items task where task.reqc_queue_id = queue_row.id) then 'IN_PROGRESS'
    else 'WAITING_QC' end,
    updated_at = now()
  where queue_row.id = new.reqc_queue_id;
  return new;
end;
$$;
