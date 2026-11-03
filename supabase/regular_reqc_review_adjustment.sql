-- Re-QC grade adjustment before review. Apply after regular_reqc_bulk_review_to_shelving.sql.
-- Apply after regular_reqc_reject_note.sql and regular_reqc_bulk_review_to_shelving.sql.
create table if not exists public.reqc_adjustments (
  id bigint generated always as identity primary key,
  reqc_result_id uuid references public.reqc_results(id) on delete set null,
  qc_item_id bigint not null references public.qc_items(id) on delete restrict,
  from_grade text not null check (from_grade in ('A', 'B', 'C')),
  to_grade text not null check (to_grade in ('A', 'B', 'C') and to_grade <> from_grade),
  qty integer not null check (qty > 0),
  note text not null check (length(trim(note)) > 0),
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists reqc_adjustments_result_idx on public.reqc_adjustments(reqc_result_id);
alter table public.reqc_adjustments enable row level security;
grant delete on public.reqc_results to authenticated;
drop policy if exists reqc_results_adjustment_delete on public.reqc_results;
create policy reqc_results_adjustment_delete on public.reqc_results for delete to authenticated
  using (status = 'PENDING_REVIEW' and public.reqc_has_permission('qc.confirmation.edit'));
grant select, insert on public.reqc_adjustments to authenticated;
drop policy if exists reqc_adjustments_read on public.reqc_adjustments;
create policy reqc_adjustments_read on public.reqc_adjustments for select to authenticated
  using (public.reqc_has_permission('qc.summary.view') or public.reqc_has_permission('qc.confirmation.edit')
    or public.reqc_has_permission('qc.grading_task.edit'));
drop policy if exists reqc_adjustments_insert on public.reqc_adjustments;
create policy reqc_adjustments_insert on public.reqc_adjustments for insert to authenticated
  with check (public.reqc_has_permission('qc.confirmation.edit'));

create or replace function public.adjust_reqc_result(
  p_result_id uuid, p_to_grade text, p_qty integer, p_note text, p_created_by text default null
) returns void language plpgsql security invoker set search_path = '' as $$
declare source_row public.reqc_results%rowtype;
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
  if exists (select 1 from public.reqc_results
    where qc_item_id = source_row.qc_item_id and grade = p_to_grade and status <> 'PENDING_REVIEW') then
    raise exception 'Destination grade has already been reviewed';
  end if;
  insert into public.reqc_adjustments(reqc_result_id, qc_item_id, from_grade, to_grade, qty, note, created_by)
  values (p_result_id, source_row.qc_item_id, source_row.grade, p_to_grade, p_qty, trim(p_note), p_created_by);
  if p_qty = source_row.qty then
    if exists (select 1 from public.reqc_results where qc_item_id = source_row.qc_item_id and grade = p_to_grade) then
      update public.reqc_results set qty = qty + p_qty, updated_at = now()
      where qc_item_id = source_row.qc_item_id and grade = p_to_grade;
      delete from public.reqc_results where id = p_result_id;
    else
      update public.reqc_results set grade = p_to_grade, updated_at = now() where id = p_result_id;
    end if;
  else
    update public.reqc_results set qty = qty - p_qty, updated_at = now() where id = p_result_id;
    insert into public.reqc_results(reqc_queue_id, qc_item_id, grade, qty)
    values (source_row.reqc_queue_id, source_row.qc_item_id, p_to_grade, p_qty)
    on conflict (qc_item_id, grade) do update
      set qty = public.reqc_results.qty + excluded.qty, updated_at = now();
  end if;
end;
$$;
revoke execute on function public.adjust_reqc_result(uuid, text, integer, text, text) from public, anon;
grant execute on function public.adjust_reqc_result(uuid, text, integer, text, text) to authenticated;

-- A later qc_items update must not replace a reviewed adjustment with raw grading quantities.
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
    on conflict (qc_item_id, grade) do update set qty = excluded.qty, updated_at = now()
    where public.reqc_results.status = 'PENDING_REVIEW';
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
