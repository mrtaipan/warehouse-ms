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
        -- A draft owner may remove their own draft. Older rows store the
        -- creator email, while newer rows may store the Auth UUID as text.
        lower(trim(coalesce(warehouse_reject_storage.created_by, ''))) = lower(trim(coalesce(profile.email, '')))
        or warehouse_reject_storage.created_by = (select auth.uid())::text
        or profile.role in ('admin')
      )
  )
);
