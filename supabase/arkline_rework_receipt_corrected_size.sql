begin;

create or replace function public.record_arkline_rework_receipt(
  p_return_batch_id uuid,
  p_receive_date date,
  p_notes text,
  p_created_by text,
  p_lines jsonb
)
returns uuid
language plpgsql
as $$
declare
  target_batch public.arkline_qc_return_batches%rowtype;
  receipt_group uuid := gen_random_uuid();
  line_record record;
  source_line public.arkline_qc_return_batch_lines%rowtype;
  source_size text;
  receipt_size text;
  correction_out_qty integer;
  segment_qty integer;
  segment_received integer;
  total_received integer;
begin
  select * into target_batch
  from public.arkline_qc_return_batches
  where id = p_return_batch_id
  for update;

  if target_batch.id is null then
    raise exception 'Return batch not found';
  end if;

  if target_batch.status in ('FULLY_RETURNED', 'CLOSED_SHORT') then
    raise exception 'Return batch is already closed';
  end if;

  for line_record in
    select *
    from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as value(
      return_batch_line_id uuid,
      size text,
      qty integer
    )
  loop
    if line_record.qty <= 0 then
      continue;
    end if;

    select * into source_line
    from public.arkline_qc_return_batch_lines
    where id = line_record.return_batch_line_id
      and return_batch_id = p_return_batch_id;

    if source_line.id is null then
      raise exception 'Return line does not belong to this return batch';
    end if;

    source_size := upper(trim(source_line.size));
    receipt_size := upper(trim(coalesce(nullif(line_record.size, ''), source_line.size)));

    if receipt_size = '' then
      raise exception 'Returned size is required';
    end if;

    if receipt_size = source_size then
      select coalesce(sum(qty), 0)
      into correction_out_qty
      from public.arkline_qc_return_size_corrections
      where from_return_batch_line_id = source_line.id;

      segment_qty := source_line.qty - correction_out_qty;
    else
      select coalesce(sum(qty), 0)
      into segment_qty
      from public.arkline_qc_return_size_corrections
      where from_return_batch_line_id = source_line.id
        and upper(trim(to_size)) = receipt_size;
    end if;

    if segment_qty <= 0 then
      raise exception 'Returned size % is not available for this return line', receipt_size;
    end if;

    select coalesce(sum(received_qty), 0)
    into segment_received
    from public.arkline_po_item_receipts
    where source_return_batch_line_id = source_line.id
      and receipt_type = 'REWORK_RETURN'
      and upper(trim(size)) = receipt_size;

    if segment_received + line_record.qty > segment_qty then
      raise exception 'Received qty exceeds the remaining corrected qty for size %', receipt_size;
    end if;

    insert into public.arkline_po_item_receipts (
      arkline_po_item_id,
      po_id,
      sku_induk,
      receipt_group_id,
      size,
      received_qty,
      receive_date,
      is_final,
      notes,
      created_by,
      receipt_type,
      source_return_batch_id,
      source_return_batch_line_id,
      round_number
    ) values (
      target_batch.arkline_po_item_id,
      target_batch.po_id,
      target_batch.sku_induk,
      receipt_group,
      receipt_size,
      line_record.qty,
      p_receive_date,
      false,
      nullif(p_notes, ''),
      nullif(p_created_by, ''),
      'REWORK_RETURN',
      target_batch.id,
      source_line.id,
      target_batch.round_number + 1
    );
  end loop;

  select coalesce(sum(received_qty), 0)
  into total_received
  from public.arkline_po_item_receipts
  where source_return_batch_id = target_batch.id
    and receipt_type = 'REWORK_RETURN';

  if total_received = 0 then
    raise exception 'Enter at least one received qty';
  end if;

  return receipt_group;
end;
$$;

grant execute on function public.record_arkline_rework_receipt(uuid, date, text, text, jsonb) to authenticated;

commit;
