-- Only Reject Storage managers may delete draft items. Posted rows remain protected.
grant delete on public.warehouse_reject_storage to authenticated;

drop policy if exists warehouse_reject_storage_authenticated_delete_draft
  on public.warehouse_reject_storage;

create policy warehouse_reject_storage_authenticated_delete_draft
on public.warehouse_reject_storage
for delete
to authenticated
using (
  status = 'DRAFT'
  and exists (
    select 1
    from public.dir_user_profiles as profile
    where profile.authenticated_id = (select auth.uid())
      and (
        profile.role in ('admin', 'qc_coordinator', 'storage_coordinator')
        or exists (
          select 1
          from public.dir_user_roles as permission
          where permission.role = profile.role
            and permission.permission_code in ('storage.location.add', 'storage.location.edit')
        )
      )
  )
);