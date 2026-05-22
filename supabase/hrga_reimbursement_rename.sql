begin;

alter table if exists public.arkline_reimbursement_attachments
  rename to hrga_reimbursement_attachments;

alter table if exists public.arkline_reimbursement_claims
  rename to hrga_reimbursement_claims;

alter index if exists public.idx_arkline_reimbursement_claims_status
  rename to idx_hrga_reimbursement_claims_status;

alter index if exists public.idx_arkline_reimbursement_claims_employee
  rename to idx_hrga_reimbursement_claims_employee;

alter index if exists public.idx_arkline_reimbursement_claims_category
  rename to idx_hrga_reimbursement_claims_category;

alter index if exists public.idx_arkline_reimbursement_attachments_claim
  rename to idx_hrga_reimbursement_attachments_claim;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'trg_arkline_reimbursement_claims_updated_at'
  ) then
    execute 'alter trigger trg_arkline_reimbursement_claims_updated_at on public.hrga_reimbursement_claims rename to trg_hrga_reimbursement_claims_updated_at';
  end if;
end
$$;

alter table public.hrga_reimbursement_attachments
  drop constraint if exists arkline_reimbursement_attachments_claim_id_fkey;

alter table public.hrga_reimbursement_attachments
  add constraint hrga_reimbursement_attachments_claim_id_fkey
  foreign key (claim_id)
  references public.hrga_reimbursement_claims(id)
  on delete cascade;

commit;
