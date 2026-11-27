-- Keep the existing read/write policies, but limit direct deletion to admins.
drop policy if exists arkline_qc_return_batches_admin_delete
  on public.arkline_qc_return_batches;
create policy arkline_qc_return_batches_admin_delete
on public.arkline_qc_return_batches
as restrictive
for delete
to authenticated
using (
  status = 'SENT'
  and returned_qty = 0
  and short_qty = 0
  and exists (
    select 1 from public.dir_user_profiles profile
    where profile.authenticated_id = (select auth.uid())
      and profile.role = 'admin'
  )
);

drop policy if exists arkline_qc_return_batch_lines_admin_delete
  on public.arkline_qc_return_batch_lines;
create policy arkline_qc_return_batch_lines_admin_delete
on public.arkline_qc_return_batch_lines
as restrictive
for delete
to authenticated
using (
  exists (
    select 1 from public.dir_user_profiles profile
    where profile.authenticated_id = (select auth.uid())
      and profile.role = 'admin'
  )
);
