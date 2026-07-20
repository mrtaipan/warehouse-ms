alter table if exists public.arkline_qc_reject_adjustments
  add column if not exists effective_date date null;

update public.arkline_qc_reject_adjustments
set effective_date = coalesce(
  (
    select min(coalesce(task.finished_at, task.updated_at, task.created_at))::date
    from public.arkline_qc task
    where task.qc_cycle_id = public.arkline_qc_reject_adjustments.qc_cycle_id
  ),
  created_at::date
)
where effective_date is null;
