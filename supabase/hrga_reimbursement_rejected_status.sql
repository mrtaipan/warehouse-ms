begin;

alter table if exists public.hrga_reimbursement_claims
  drop constraint if exists arkline_reimbursement_claim_status_check;

alter table if exists public.hrga_reimbursement_claims
  drop constraint if exists hrga_reimbursement_claim_status_check;

alter table if exists public.hrga_reimbursement_claims
  add constraint hrga_reimbursement_claim_status_check
  check (status in ('SUBMITTED', 'NEED_REVISION', 'APPROVED', 'PAID', 'REJECTED'));

commit;
