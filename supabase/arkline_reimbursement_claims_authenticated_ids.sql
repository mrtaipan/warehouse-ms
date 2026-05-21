begin;

alter table public.arkline_reimbursement_claims
  drop constraint if exists arkline_reimbursement_claims_employee_profile_id_fkey;

alter table public.arkline_reimbursement_claims
  drop constraint if exists arkline_reimbursement_claims_payee_profile_id_fkey;

alter table public.arkline_reimbursement_claims
  drop constraint if exists arkline_reimbursement_claims_employee_authenticated_id_fkey;

alter table public.arkline_reimbursement_claims
  drop constraint if exists arkline_reimbursement_claims_payee_authenticated_id_fkey;

alter table public.arkline_reimbursement_claims
  rename column employee_profile_id to employee_authenticated_id;

alter table public.arkline_reimbursement_claims
  rename column payee_profile_id to payee_authenticated_id;

drop index if exists idx_arkline_reimbursement_claims_employee;

create index if not exists idx_arkline_reimbursement_claims_employee
  on public.arkline_reimbursement_claims (employee_authenticated_id, submitted_at asc);

alter table public.arkline_reimbursement_claims
  add constraint arkline_reimbursement_claims_employee_authenticated_id_fkey
  foreign key (employee_authenticated_id)
  references auth.users (id)
  on delete set null;

alter table public.arkline_reimbursement_claims
  add constraint arkline_reimbursement_claims_payee_authenticated_id_fkey
  foreign key (payee_authenticated_id)
  references auth.users (id)
  on delete set null;

commit;
