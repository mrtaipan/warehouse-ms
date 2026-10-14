-- Allow Arkline Rejection Storage to register packing reject items manually.
-- QC-origin rows still keep their reject detail validation.

alter table if exists public.arkline_qc_rejection_storage_batches
  add column if not exists source_type text not null default 'QC_REJECT';

alter table if exists public.arkline_qc_rejection_storage_batches
  drop constraint if exists arkline_qc_rejection_storage_batches_source_type_check;

alter table if exists public.arkline_qc_rejection_storage_batches
  add constraint arkline_qc_rejection_storage_batches_source_type_check
    check (source_type in ('QC_REJECT', 'PACKING_REJECT'));

alter table if exists public.arkline_qc_rejection_storage_batches
  alter column source_qc_cycle_id drop not null;

alter table if exists public.arkline_qc_rejection_storage_lines
  alter column reject_detail_id drop not null;

create index if not exists arkline_qc_rejection_storage_batches_source_type_idx
  on public.arkline_qc_rejection_storage_batches (source_type, storage_date desc);

create or replace function public.validate_arkline_qc_rejection_storage_line_qty()
returns trigger
language plpgsql
as $$
declare
  source_detail public.arkline_qc_reject_details%rowtype;
  used_qty integer;
begin
  if new.reject_detail_id is null then
    return new;
  end if;

  select * into source_detail
  from public.arkline_qc_reject_details
  where id = new.reject_detail_id;

  if source_detail.id is null then
    raise exception 'Reject detail not found';
  end if;

  select
    coalesce((select sum(qty) from public.arkline_qc_return_batch_lines where reject_detail_id = new.reject_detail_id), 0) +
    coalesce((
      select sum(qty)
      from public.arkline_qc_rejection_storage_lines
      where reject_detail_id = new.reject_detail_id
        and id is distinct from new.id
    ), 0)
  into used_qty;

  if used_qty + new.qty > source_detail.qty then
    raise exception 'Stored qty exceeds available reject qty for detail %', new.reject_detail_id;
  end if;

  return new;
end;
$$;

create or replace function public.create_arkline_qc_rejection_storage_batch(
  p_storage_number text,
  p_po_id text,
  p_arkline_po_item_id uuid,
  p_sku_induk text,
  p_model_name text,
  p_supplier_name text,
  p_source_qc_cycle_id uuid,
  p_round_number integer,
  p_storage_date date,
  p_notes text,
  p_created_by text,
  p_lines jsonb
)
returns uuid
language plpgsql
as $$
declare
  created_batch_id uuid;
  total_qty integer;
  line_record record;
  source_type_value text;
begin
  if nullif(trim(p_storage_number), '') is null then
    raise exception 'Storage number is required';
  end if;

  select coalesce(sum(value.qty), 0)
  into total_qty
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as value(
    reject_detail_id uuid,
    reject_reason_id uuid,
    grade text,
    size text,
    qty integer
  );

  if total_qty <= 0 then
    raise exception 'Rejection storage batch must contain at least one positive qty line';
  end if;

  select case
    when exists (
      select 1
      from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as value(reject_detail_id uuid)
      where value.reject_detail_id is not null
    ) then 'QC_REJECT'
    else 'PACKING_REJECT'
  end into source_type_value;

  if source_type_value = 'QC_REJECT' and p_source_qc_cycle_id is null then
    raise exception 'QC rejection storage requires a QC cycle source';
  end if;

  insert into public.arkline_qc_rejection_storage_batches (
    storage_number,
    po_id,
    arkline_po_item_id,
    sku_induk,
    model_name_snapshot,
    supplier_name_snapshot,
    source_qc_cycle_id,
    source_type,
    round_number,
    storage_date,
    stored_qty,
    notes,
    created_by
  ) values (
    trim(p_storage_number),
    p_po_id,
    p_arkline_po_item_id,
    p_sku_induk,
    p_model_name,
    nullif(p_supplier_name, ''),
    p_source_qc_cycle_id,
    source_type_value,
    coalesce(p_round_number, 1),
    p_storage_date,
    total_qty,
    nullif(p_notes, ''),
    nullif(p_created_by, '')
  )
  returning id into created_batch_id;

  for line_record in
    select *
    from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as value(
      reject_detail_id uuid,
      reject_reason_id uuid,
      grade text,
      size text,
      qty integer
    )
  loop
    insert into public.arkline_qc_rejection_storage_lines (
      storage_batch_id,
      reject_detail_id,
      reject_reason_id,
      grade,
      size,
      qty
    ) values (
      created_batch_id,
      line_record.reject_detail_id,
      line_record.reject_reason_id,
      upper(line_record.grade),
      upper(trim(line_record.size)),
      line_record.qty
    );
  end loop;

  return created_batch_id;
end;
$$;

grant execute on function public.create_arkline_qc_rejection_storage_batch(text, text, uuid, text, text, text, uuid, integer, date, text, text, jsonb) to authenticated;
