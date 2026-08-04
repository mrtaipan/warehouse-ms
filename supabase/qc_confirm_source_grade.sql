alter table public.qc_confirm
  add column if not exists source_grade text null;

alter table public.qc_confirm
  drop constraint if exists qc_confirm_source_grade_check;

alter table public.qc_confirm
  add constraint qc_confirm_source_grade_check
  check (source_grade is null or source_grade in ('A', 'B', 'C'));

update public.qc_confirm
set source_grade = grade
where source_grade is null
  and is_adjustment = true
  and adjustment_type = 'TRANSFER';

create index if not exists qc_confirm_source_grade_idx
  on public.qc_confirm (inbound_id, source_grade);
