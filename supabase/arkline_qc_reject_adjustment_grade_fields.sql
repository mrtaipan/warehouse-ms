alter table if exists public.arkline_qc_reject_adjustments
  add column if not exists from_grade text null,
  add column if not exists to_grade text null,
  add column if not exists affected_grade text null;

alter table if exists public.arkline_qc_reject_adjustments
  drop constraint if exists arkline_qc_reject_adjustments_type_check,
  drop constraint if exists arkline_qc_reject_adjustments_from_grade_check,
  drop constraint if exists arkline_qc_reject_adjustments_to_grade_check,
  drop constraint if exists arkline_qc_reject_adjustments_affected_grade_check;

alter table if exists public.arkline_qc_reject_adjustments
  add constraint arkline_qc_reject_adjustments_type_check
    check (adjustment_type in ('bc_to_a', 'transfer', 'inspector_data_error')),
  add constraint arkline_qc_reject_adjustments_from_grade_check
    check (from_grade is null or from_grade in ('A', 'B', 'C')),
  add constraint arkline_qc_reject_adjustments_to_grade_check
    check (to_grade is null or to_grade in ('A', 'B', 'C')),
  add constraint arkline_qc_reject_adjustments_affected_grade_check
    check (affected_grade is null or affected_grade in ('A', 'B', 'C'));
