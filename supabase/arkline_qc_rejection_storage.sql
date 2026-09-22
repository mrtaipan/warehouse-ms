create table if not exists public.arkline_qc_rejection_storage_batches (
  id uuid primary key default gen_random_uuid(),
  storage_number text not null,
  po_id text not null,
  arkline_po_item_id uuid not null references public.arkline_po_items(id) on update cascade on delete restrict,
  sku_induk text not null,
  model_name_snapshot text not null,
  supplier_name_snapshot text null,
  source_qc_cycle_id uuid not null,
  round_number integer not null default 1 check (round_number > 0),
  storage_date date not null default current_date,
  stored_qty integer not null check (stored_qty > 0),
  status text not null default 'STORED',
  notes text null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_qc_rejection_storage_batches_status_check
    check (status in ('STORED', 'RELEASED'))
);

create table if not exists public.arkline_qc_rejection_storage_lines (
  id uuid primary key default gen_random_uuid(),
  storage_batch_id uuid not null references public.arkline_qc_rejection_storage_batches(id) on update cascade on delete cascade,
  reject_detail_id uuid not null references public.arkline_qc_reject_details(id) on update cascade on delete restrict,
  reject_reason_id uuid not null references public.arkline_qc_reject_reasons(id) on update cascade on delete restrict,
  grade text not null check (grade in ('B', 'C')),
  size text not null,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  constraint arkline_qc_rejection_storage_lines_detail_key unique (storage_batch_id, reject_detail_id)
);

create index if not exists arkline_qc_rejection_storage_batches_po_item_idx
  on public.arkline_qc_rejection_storage_batches (po_id, arkline_po_item_id, storage_date desc);

create index if not exists arkline_qc_rejection_storage_batches_source_cycle_idx
  on public.arkline_qc_rejection_storage_batches (source_qc_cycle_id);

create index if not exists arkline_qc_rejection_storage_lines_batch_idx
  on public.arkline_qc_rejection_storage_lines (storage_batch_id);

create index if not exists arkline_qc_rejection_storage_lines_reject_detail_idx
  on public.arkline_qc_rejection_storage_lines (reject_detail_id);

create or replace function public.validate_arkline_qc_rejection_storage_line_qty()
returns trigger
language plpgsql
as $$
declare
  source_detail public.arkline_qc_reject_details%rowtype;
  used_qty integer;
begin
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

drop trigger if exists arkline_qc_rejection_storage_lines_validate_qty on public.arkline_qc_rejection_storage_lines;
create trigger arkline_qc_rejection_storage_lines_validate_qty
before insert or update on public.arkline_qc_rejection_storage_lines
for each row execute function public.validate_arkline_qc_rejection_storage_line_qty();

create or replace function public.set_arkline_qc_rejection_storage_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_qc_rejection_storage_batches_set_updated_at on public.arkline_qc_rejection_storage_batches;
create trigger arkline_qc_rejection_storage_batches_set_updated_at
before update on public.arkline_qc_rejection_storage_batches
for each row execute function public.set_arkline_qc_rejection_storage_updated_at();

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

  insert into public.arkline_qc_rejection_storage_batches (
    storage_number,
    po_id,
    arkline_po_item_id,
    sku_induk,
    model_name_snapshot,
    supplier_name_snapshot,
    source_qc_cycle_id,
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
    p_round_number,
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
      line_record.size,
      line_record.qty
    );
  end loop;

  return created_batch_id;
end;
$$;

alter table public.arkline_qc_rejection_storage_batches enable row level security;
alter table public.arkline_qc_rejection_storage_lines enable row level security;

grant select, insert, update, delete on public.arkline_qc_rejection_storage_batches to authenticated;
grant select, insert, update, delete on public.arkline_qc_rejection_storage_lines to authenticated;
grant execute on function public.create_arkline_qc_rejection_storage_batch(text, text, uuid, text, text, text, uuid, integer, date, text, text, jsonb) to authenticated;

drop policy if exists arkline_qc_rejection_storage_batches_authenticated_all on public.arkline_qc_rejection_storage_batches;
create policy arkline_qc_rejection_storage_batches_authenticated_all
on public.arkline_qc_rejection_storage_batches
for all
to authenticated
using (true)
with check (true);

drop policy if exists arkline_qc_rejection_storage_lines_authenticated_all on public.arkline_qc_rejection_storage_lines;
create policy arkline_qc_rejection_storage_lines_authenticated_all
on public.arkline_qc_rejection_storage_lines
for all
to authenticated
using (true)
with check (true);
