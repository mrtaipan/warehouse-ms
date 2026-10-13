-- Run once after upload_sales_import_arkline_workflow.sql and
-- upload_sales_import_group_modes.sql. Existing reversed batches remain reversed.
begin;

alter table public.upload_sales_import_batches
  add column if not exists cancelled_by text,
  add column if not exists cancelled_at timestamptz;

create or replace function public.cancel_upload_sales_import_batch(
  p_batch_id uuid,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_batch public.upload_sales_import_batches%rowtype;
begin
  if not public.arkline_upload_can_manage() then
    raise exception 'Not allowed to cancel upload batches';
  end if;

  select * into target_batch
  from public.upload_sales_import_batches
  where id = p_batch_id
  for update;

  if target_batch.id is null then
    raise exception 'Upload batch not found';
  end if;
  if target_batch.status <> 'pending_settlement' then
    raise exception 'Only pending upload batches can be cancelled';
  end if;

  update public.upload_sales_import_batches
  set status = 'cancelled',
      cancelled_by = nullif(trim(coalesce(p_actor_email, '')), ''),
      cancelled_at = now(),
      settlement_error = null,
      raw_retention_until = now() + interval '7 days',
      updated_at = now()
  where id = p_batch_id;

  return jsonb_build_object('batch_id', p_batch_id, 'status', 'cancelled');
end;
$$;

create or replace function public.delete_upload_sales_import_batch(
  p_batch_id uuid,
  p_actor_email text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_batch public.upload_sales_import_batches%rowtype;
  deleted_line_count integer := 0;
  deleted_movement_count integer := 0;
begin
  if not public.arkline_upload_can_manage() then
    raise exception 'Not allowed to delete upload batches';
  end if;

  select * into target_batch
  from public.upload_sales_import_batches
  where id = p_batch_id
  for update;

  if target_batch.id is null then
    raise exception 'Upload batch not found';
  end if;
  if target_batch.status not in ('draft', 'cancelled', 'reversed') then
    raise exception 'Only draft, cancelled, or reversed upload batches can be deleted';
  end if;

  delete from public.upload_warehouse_storage_movements
  where source_batch_id = p_batch_id;
  get diagnostics deleted_movement_count = row_count;

  delete from public.upload_sales_import_lines
  where batch_id = p_batch_id;
  get diagnostics deleted_line_count = row_count;

  delete from public.upload_sales_import_batches
  where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'status', 'deleted',
    'deleted_lines', deleted_line_count,
    'deleted_movements', deleted_movement_count,
    'deleted_by', nullif(trim(coalesce(p_actor_email, '')), '')
  );
end;
$$;

revoke execute on function public.cancel_upload_sales_import_batch(uuid, text) from public, anon;
grant execute on function public.cancel_upload_sales_import_batch(uuid, text) to authenticated;
revoke execute on function public.delete_upload_sales_import_batch(uuid, text) from public, anon;
grant execute on function public.delete_upload_sales_import_batch(uuid, text) to authenticated;

commit;
