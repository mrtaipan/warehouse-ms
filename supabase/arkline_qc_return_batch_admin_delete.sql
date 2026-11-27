-- Run after arkline_qc_return_rework.sql.
-- A sent batch can be removed only before any receiving or Re-QC activity.
create or replace function public.delete_unreceived_arkline_qc_return_batch(
  p_return_batch_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_batch public.arkline_qc_return_batches%rowtype;
begin
  if not exists (
    select 1
    from public.dir_user_profiles profile
    where profile.authenticated_id = auth.uid()
      and profile.role = 'admin'
  ) then
    raise exception 'Only admins can delete return batches';
  end if;

  select * into target_batch
  from public.arkline_qc_return_batches
  where id = p_return_batch_id
  for update;

  if target_batch.id is null then
    raise exception 'Return batch not found';
  end if;

  if target_batch.status <> 'SENT'
    or target_batch.returned_qty <> 0
    or target_batch.short_qty <> 0
    or exists (
      select 1 from public.arkline_po_item_receipts receipt
      where receipt.source_return_batch_id = p_return_batch_id
    )
    or exists (
      select 1 from public.arkline_qc task
      where task.source_return_batch_id = p_return_batch_id
    )
    or exists (
      select 1 from public.arkline_qc_return_size_corrections correction
      where correction.return_batch_id = p_return_batch_id
    ) then
    raise exception 'Only sent batches without receipts, Re-QC tasks, or size corrections can be deleted';
  end if;

  -- Batch lines cascade away; their reject quantities become available again.
  delete from public.arkline_qc_return_batches
  where id = p_return_batch_id;
end;
$$;

revoke all on function public.delete_unreceived_arkline_qc_return_batch(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_unreceived_arkline_qc_return_batch(uuid)
  to authenticated;
