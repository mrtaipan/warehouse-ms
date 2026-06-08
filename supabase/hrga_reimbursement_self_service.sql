begin;

create or replace function public.reimbursement_is_hrga_reviewer()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.dir_user_profiles profile
    where profile.authenticated_id = auth.uid()
      and profile.role in ('hrga', 'leader')
  )
$$;

drop policy if exists "authenticated_select_hrga_reimbursement_claims" on public.hrga_reimbursement_claims;
drop policy if exists "authenticated_insert_hrga_reimbursement_claims" on public.hrga_reimbursement_claims;
drop policy if exists "authenticated_update_hrga_reimbursement_claims" on public.hrga_reimbursement_claims;

create policy "authenticated_select_hrga_reimbursement_claims"
on public.hrga_reimbursement_claims for select to authenticated
using (
  public.reimbursement_is_admin()
  or public.reimbursement_has_permission('arkline.finance.reimbursement.view')
  or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
  or public.reimbursement_has_permission('arkline.finance.reimbursement.pay')
  or public.reimbursement_is_hrga_reviewer()
  or public.reimbursement_is_claim_owner(created_by, employee_email_snapshot)
);

create policy "authenticated_insert_hrga_reimbursement_claims"
on public.hrga_reimbursement_claims for insert to authenticated
with check (
  status = 'SUBMITTED'
  and public.reimbursement_is_claim_owner(created_by, employee_email_snapshot)
  and employee_authenticated_id = auth.uid()
  and (
    public.reimbursement_has_permission('arkline.finance.reimbursement.submit')
    or employee_authenticated_id = auth.uid()
  )
);

create policy "authenticated_update_hrga_reimbursement_claims"
on public.hrga_reimbursement_claims for update to authenticated
using (
  public.reimbursement_is_admin()
  or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
  or public.reimbursement_has_permission('arkline.finance.reimbursement.pay')
  or (
    status = 'SUBMITTED'
    and public.reimbursement_is_claim_owner(created_by, employee_email_snapshot)
  )
)
with check (
  public.reimbursement_is_admin()
  or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
  or public.reimbursement_has_permission('arkline.finance.reimbursement.pay')
  or (
    status = 'SUBMITTED'
    and public.reimbursement_is_claim_owner(created_by, employee_email_snapshot)
  )
);

drop policy if exists "authenticated_select_hrga_reimbursement_attachments" on public.hrga_reimbursement_attachments;

create policy "authenticated_select_hrga_reimbursement_attachments"
on public.hrga_reimbursement_attachments for select to authenticated
using (
  exists (
    select 1
    from public.hrga_reimbursement_claims claim_row
    where claim_row.id = claim_id
      and (
        public.reimbursement_is_admin()
        or public.reimbursement_has_permission('arkline.finance.reimbursement.view')
        or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
        or public.reimbursement_has_permission('arkline.finance.reimbursement.pay')
        or public.reimbursement_is_hrga_reviewer()
        or public.reimbursement_is_claim_owner(claim_row.created_by, claim_row.employee_email_snapshot)
      )
  )
);

drop policy if exists "authenticated_select_reimbursement_claims_bucket" on storage.objects;

create policy "authenticated_select_reimbursement_claims_bucket"
on storage.objects for select to authenticated
using (
  bucket_id = 'reimbursement-claims'
  and exists (
    select 1
    from public.hrga_reimbursement_attachments attachment
    join public.hrga_reimbursement_claims claim_row
      on claim_row.id = attachment.claim_id
    where attachment.storage_bucket = bucket_id
      and attachment.storage_path = name
      and (
        public.reimbursement_is_admin()
        or public.reimbursement_has_permission('arkline.finance.reimbursement.view')
        or public.reimbursement_has_permission('arkline.finance.reimbursement.approve')
        or public.reimbursement_has_permission('arkline.finance.reimbursement.pay')
        or public.reimbursement_is_hrga_reviewer()
        or public.reimbursement_is_claim_owner(claim_row.created_by, claim_row.employee_email_snapshot)
      )
  )
);

commit;
