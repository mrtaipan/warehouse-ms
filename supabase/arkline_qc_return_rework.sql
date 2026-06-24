begin;

create extension if not exists pgcrypto;

alter table public.arkline_qc_reject_reasons
  add column if not exists is_repairable boolean not null default false;

alter table public.arkline_qc_reject_details
  add column if not exists po_id text null,
  add column if not exists arkline_po_item_id uuid null references public.arkline_po_items(id) on update cascade on delete set null,
  add column if not exists sku_induk text null,
  add column if not exists model_name text null;

create sequence if not exists public.arkline_qc_return_number_seq;

create or replace function public.next_arkline_qc_return_number()
returns text
language sql
as $$
  select 'ARK-RET-' || to_char(current_date, 'YYYYMM') || '-' ||
    lpad(nextval('public.arkline_qc_return_number_seq')::text, 4, '0');
$$;

create table if not exists public.arkline_qc_return_batches (
  id uuid primary key default gen_random_uuid(),
  return_number text not null default public.next_arkline_qc_return_number(),
  po_id text not null,
  arkline_po_item_id uuid not null references public.arkline_po_items(id) on update cascade on delete restrict,
  sku_induk text not null,
  model_name_snapshot text not null,
  supplier_name_snapshot text null,
  source_qc_cycle_id uuid not null,
  round_number integer not null default 1 check (round_number > 0),
  return_date date not null default current_date,
  sent_qty integer not null check (sent_qty > 0),
  returned_qty integer not null default 0 check (returned_qty >= 0),
  short_qty integer not null default 0 check (short_qty >= 0),
  status text not null default 'SENT',
  shipping_method text null,
  notes text null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_qc_return_batches_return_number_key unique (return_number),
  constraint arkline_qc_return_batches_status_check
    check (status in ('SENT', 'PARTIALLY_RETURNED', 'FULLY_RETURNED', 'CLOSED_SHORT')),
  constraint arkline_qc_return_batches_reconciled_qty_check
    check (returned_qty + short_qty <= sent_qty)
);

create table if not exists public.arkline_qc_return_batch_lines (
  id uuid primary key default gen_random_uuid(),
  return_batch_id uuid not null references public.arkline_qc_return_batches(id) on update cascade on delete cascade,
  reject_detail_id uuid not null references public.arkline_qc_reject_details(id) on update cascade on delete restrict,
  reject_reason_id uuid not null references public.arkline_qc_reject_reasons(id) on update cascade on delete restrict,
  grade text not null check (grade in ('B', 'C')),
  size text not null,
  qty integer not null check (qty > 0),
  created_at timestamptz not null default now(),
  constraint arkline_qc_return_batch_lines_detail_key unique (return_batch_id, reject_detail_id)
);

alter table public.arkline_qc_return_batches
  drop constraint if exists arkline_qc_return_batches_source_qc_cycle_id_fkey;

alter table public.arkline_qc_return_batches
  add column if not exists closed_short_notes text null,
  add column if not exists closed_short_by text null,
  add column if not exists closed_short_at timestamptz null;

alter table public.arkline_po_item_receipts
  add column if not exists receipt_type text not null default 'INITIAL',
  add column if not exists source_return_batch_id uuid null,
  add column if not exists source_return_batch_line_id uuid null,
  add column if not exists round_number integer not null default 1;

alter table public.arkline_po_item_receipts
  drop constraint if exists arkline_po_item_receipts_receipt_type_check;

alter table public.arkline_po_item_receipts
  add constraint arkline_po_item_receipts_receipt_type_check
  check (receipt_type in ('INITIAL', 'REWORK_RETURN'));

alter table public.arkline_po_item_receipts
  drop constraint if exists arkline_po_item_receipts_round_number_check;

alter table public.arkline_po_item_receipts
  add constraint arkline_po_item_receipts_round_number_check
  check (round_number > 0);

alter table public.arkline_po_item_receipts
  drop constraint if exists arkline_po_item_receipts_source_return_batch_id_fkey;

alter table public.arkline_po_item_receipts
  add constraint arkline_po_item_receipts_source_return_batch_id_fkey
  foreign key (source_return_batch_id)
  references public.arkline_qc_return_batches(id)
  on update cascade
  on delete restrict;

alter table public.arkline_po_item_receipts
  drop constraint if exists arkline_po_item_receipts_source_return_batch_line_id_fkey;

alter table public.arkline_po_item_receipts
  add constraint arkline_po_item_receipts_source_return_batch_line_id_fkey
  foreign key (source_return_batch_line_id)
  references public.arkline_qc_return_batch_lines(id)
  on update cascade
  on delete restrict;

alter table public.arkline_qc
  add column if not exists qc_cycle_id uuid null,
  add column if not exists source_receipt_group_id uuid null,
  add column if not exists source_return_batch_id uuid null,
  add column if not exists qc_round_number integer not null default 1,
  add column if not exists qc_type text not null default 'INITIAL';

with cycle_groups as (
  select
    coalesce(po_id, '') as po_key,
    coalesce(arkline_po_item_id::text, '') as item_key,
    coalesce(sku_induk, '') as sku_key,
    coalesce(model_name, '') as model_key,
    coalesce(qc_round_number, 1) as round_key,
    gen_random_uuid() as cycle_id
  from public.arkline_qc
  where qc_cycle_id is null
  group by 1, 2, 3, 4, 5
)
update public.arkline_qc task
set qc_cycle_id = groups.cycle_id
from cycle_groups groups
where task.qc_cycle_id is null
  and coalesce(task.po_id, '') = groups.po_key
  and coalesce(task.arkline_po_item_id::text, '') = groups.item_key
  and coalesce(task.sku_induk, '') = groups.sku_key
  and coalesce(task.model_name, '') = groups.model_key
  and coalesce(task.qc_round_number, 1) = groups.round_key;

alter table public.arkline_qc
  alter column qc_cycle_id set default gen_random_uuid(),
  alter column qc_cycle_id set not null;

update public.arkline_qc_reject_details detail
set
  po_id = coalesce(detail.po_id, task.po_id),
  arkline_po_item_id = coalesce(detail.arkline_po_item_id, task.arkline_po_item_id),
  sku_induk = coalesce(detail.sku_induk, task.sku_induk),
  model_name = coalesce(detail.model_name, task.model_name)
from public.arkline_qc task
where task.id = detail.arkline_qc_id
  and (
    detail.po_id is null
    or detail.arkline_po_item_id is null
    or detail.sku_induk is null
    or detail.model_name is null
  );

alter table public.arkline_qc_reject_adjustments
  add column if not exists qc_cycle_id uuid null,
  add column if not exists arkline_po_item_id uuid null references public.arkline_po_items(id) on update cascade on delete set null;

create index if not exists arkline_qc_reject_adjustments_cycle_idx
  on public.arkline_qc_reject_adjustments (qc_cycle_id);

alter table public.arkline_qc
  drop constraint if exists arkline_qc_qc_type_check;

alter table public.arkline_qc
  add constraint arkline_qc_qc_type_check
  check (qc_type in ('INITIAL', 'RE_QC'));

alter table public.arkline_qc
  drop constraint if exists arkline_qc_qc_round_number_check;

alter table public.arkline_qc
  add constraint arkline_qc_qc_round_number_check
  check (qc_round_number > 0);

alter table public.arkline_qc
  drop constraint if exists arkline_qc_source_return_batch_id_fkey;

alter table public.arkline_qc
  add constraint arkline_qc_source_return_batch_id_fkey
  foreign key (source_return_batch_id)
  references public.arkline_qc_return_batches(id)
  on update cascade
  on delete restrict;

create index if not exists arkline_qc_return_batches_po_item_idx
  on public.arkline_qc_return_batches (po_id, arkline_po_item_id, return_date desc);

create index if not exists arkline_qc_return_batches_source_cycle_idx
  on public.arkline_qc_return_batches (source_qc_cycle_id);

create index if not exists arkline_qc_return_batch_lines_batch_idx
  on public.arkline_qc_return_batch_lines (return_batch_id);

create index if not exists arkline_qc_return_batch_lines_reject_detail_idx
  on public.arkline_qc_return_batch_lines (reject_detail_id);

create index if not exists arkline_po_item_receipts_rework_source_idx
  on public.arkline_po_item_receipts (source_return_batch_id, receipt_group_id);

create index if not exists arkline_qc_receipt_source_idx
  on public.arkline_qc (source_receipt_group_id, qc_round_number);

create or replace function public.validate_arkline_qc_return_line_qty()
returns trigger
language plpgsql
as $$
declare
  reject_qty integer;
  already_returned integer;
  detail_cycle_id uuid;
  detail_po_item_id uuid;
  batch_cycle_id uuid;
  batch_po_item_id uuid;
begin
  select detail.qty, task.qc_cycle_id, coalesce(detail.arkline_po_item_id, task.arkline_po_item_id)
  into reject_qty, detail_cycle_id, detail_po_item_id
  from public.arkline_qc_reject_details detail
  join public.arkline_qc task on task.id = detail.arkline_qc_id
  where detail.id = new.reject_detail_id
  for update of detail;

  select source_qc_cycle_id, arkline_po_item_id
  into batch_cycle_id, batch_po_item_id
  from public.arkline_qc_return_batches
  where id = new.return_batch_id;

  if detail_cycle_id is distinct from batch_cycle_id or detail_po_item_id is distinct from batch_po_item_id then
    raise exception 'Return line must belong to the same PO product and QC cycle as its return batch';
  end if;

  select coalesce(sum(qty), 0) into already_returned
  from public.arkline_qc_return_batch_lines
  where reject_detail_id = new.reject_detail_id
    and id is distinct from new.id;

  if already_returned + new.qty > reject_qty then
    raise exception 'Return qty exceeds the available reject qty for detail %', new.reject_detail_id;
  end if;

  return new;
end;
$$;

drop trigger if exists arkline_qc_return_batch_lines_validate_qty on public.arkline_qc_return_batch_lines;
create trigger arkline_qc_return_batch_lines_validate_qty
before insert or update on public.arkline_qc_return_batch_lines
for each row execute function public.validate_arkline_qc_return_line_qty();

create or replace function public.validate_arkline_rework_receipt_qty()
returns trigger
language plpgsql
as $$
declare
  line_qty integer;
  already_received integer;
begin
  if new.receipt_type <> 'REWORK_RETURN' then
    return new;
  end if;

  if new.source_return_batch_id is null or new.source_return_batch_line_id is null then
    raise exception 'Rework receipt must reference its return batch and return line';
  end if;

  select qty into line_qty
  from public.arkline_qc_return_batch_lines
  where id = new.source_return_batch_line_id
    and return_batch_id = new.source_return_batch_id
  for update;

  if line_qty is null then
    raise exception 'Return line does not belong to the selected return batch';
  end if;

  select coalesce(sum(received_qty), 0) into already_received
  from public.arkline_po_item_receipts
  where source_return_batch_line_id = new.source_return_batch_line_id
    and id is distinct from new.id;

  if already_received + new.received_qty > line_qty then
    raise exception 'Received qty exceeds the remaining returned qty for line %', new.source_return_batch_line_id;
  end if;

  return new;
end;
$$;

drop trigger if exists arkline_po_item_receipts_validate_rework_qty on public.arkline_po_item_receipts;
create trigger arkline_po_item_receipts_validate_rework_qty
before insert or update on public.arkline_po_item_receipts
for each row execute function public.validate_arkline_rework_receipt_qty();

create or replace function public.sync_arkline_qc_return_received_qty()
returns trigger
language plpgsql
as $$
declare
  target_batch_id uuid;
  total_received integer;
  sent integer;
  current_status text;
begin
  target_batch_id = case
    when tg_op = 'DELETE' then old.source_return_batch_id
    when tg_op = 'UPDATE' then coalesce(new.source_return_batch_id, old.source_return_batch_id)
    else new.source_return_batch_id
  end;

  if target_batch_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select sent_qty, status into sent, current_status
  from public.arkline_qc_return_batches
  where id = target_batch_id;

  select coalesce(sum(received_qty), 0) into total_received
  from public.arkline_po_item_receipts
  where source_return_batch_id = target_batch_id
    and receipt_type = 'REWORK_RETURN';

  update public.arkline_qc_return_batches
  set
    returned_qty = total_received,
    status = case
      when current_status = 'CLOSED_SHORT' then current_status
      when total_received >= sent then 'FULLY_RETURNED'
      when total_received > 0 then 'PARTIALLY_RETURNED'
      else 'SENT'
    end
  where id = target_batch_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists arkline_po_item_receipts_sync_return_qty on public.arkline_po_item_receipts;
create trigger arkline_po_item_receipts_sync_return_qty
after insert or update or delete on public.arkline_po_item_receipts
for each row execute function public.sync_arkline_qc_return_received_qty();

create or replace function public.create_arkline_qc_return_batch(
  p_po_id text,
  p_arkline_po_item_id uuid,
  p_sku_induk text,
  p_model_name text,
  p_supplier_name text,
  p_source_qc_cycle_id uuid,
  p_round_number integer,
  p_return_date date,
  p_shipping_method text,
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
    raise exception 'Return batch must contain at least one positive qty line';
  end if;

  insert into public.arkline_qc_return_batches (
    po_id,
    arkline_po_item_id,
    sku_induk,
    model_name_snapshot,
    supplier_name_snapshot,
    source_qc_cycle_id,
    round_number,
    return_date,
    sent_qty,
    shipping_method,
    notes,
    created_by
  ) values (
    p_po_id,
    p_arkline_po_item_id,
    p_sku_induk,
    p_model_name,
    nullif(p_supplier_name, ''),
    p_source_qc_cycle_id,
    p_round_number,
    p_return_date,
    total_qty,
    nullif(p_shipping_method, ''),
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
    insert into public.arkline_qc_return_batch_lines (
      return_batch_id,
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

drop function if exists public.record_arkline_rework_receipt(uuid, date, text, text, boolean, jsonb);

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
      source_line.size,
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

create or replace function public.close_arkline_return_shortage(
  p_return_batch_id uuid,
  p_notes text,
  p_closed_by text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_batch public.arkline_qc_return_batches%rowtype;
  can_close boolean;
begin
  select exists (
    select 1
    from public.dir_user_profiles profile
    where (
        profile.authenticated_id = auth.uid()
        or lower(coalesce(profile.email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
      and (
        profile.role = 'admin'
        or exists (
          select 1
          from public.dir_user_roles role_permission
          where role_permission.role = profile.role
            and role_permission.permission_code = 'arkline.progress_snapshot.kanban.edit'
        )
      )
  ) into can_close;

  if not can_close then
    raise exception 'You do not have permission to close return shortage';
  end if;

  if nullif(trim(p_notes), '') is null then
    raise exception 'Shortage closing notes are required';
  end if;

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

  if target_batch.returned_qty >= target_batch.sent_qty then
    raise exception 'There is no outstanding return qty to close';
  end if;

  update public.arkline_qc_return_batches
  set
    short_qty = sent_qty - returned_qty,
    status = 'CLOSED_SHORT',
    closed_short_notes = trim(p_notes),
    closed_short_by = nullif(trim(p_closed_by), ''),
    closed_short_at = now()
  where id = p_return_batch_id;
end;
$$;

create or replace function public.refresh_arkline_po_item_actual_qty(target_item_id uuid)
returns void
language plpgsql
as $$
declare
  initial_received integer;
  closed_short integer;
  last_initial_receive_date date;
begin
  select
    coalesce(sum(received_qty), 0),
    max(receive_date)
  into initial_received, last_initial_receive_date
  from public.arkline_po_item_receipts
  where arkline_po_item_id = target_item_id
    and receipt_type = 'INITIAL';

  select coalesce(sum(short_qty), 0)
  into closed_short
  from public.arkline_qc_return_batches
  where arkline_po_item_id = target_item_id
    and status = 'CLOSED_SHORT';

  update public.arkline_po_items item
  set
    actual_qty = greatest(0, initial_received - closed_short),
    completion_date = case
      when greatest(0, initial_received - closed_short) >= coalesce(item.total_qty, 0)
        then last_initial_receive_date
      else null
    end
  where item.id = target_item_id;

  return;
end;
$$;

create or replace function public.sync_arkline_po_item_receipt_summary()
returns trigger
language plpgsql
as $$
declare
  target_item_id uuid;
begin
  if tg_op = 'UPDATE' and old.arkline_po_item_id is distinct from new.arkline_po_item_id then
    perform public.refresh_arkline_po_item_actual_qty(old.arkline_po_item_id);
  end if;

  target_item_id = case
    when tg_op = 'DELETE' then old.arkline_po_item_id
    else new.arkline_po_item_id
  end;

  perform public.refresh_arkline_po_item_actual_qty(target_item_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists arkline_po_item_receipts_sync_summary on public.arkline_po_item_receipts;
create trigger arkline_po_item_receipts_sync_summary
after insert or update or delete
on public.arkline_po_item_receipts
for each row execute function public.sync_arkline_po_item_receipt_summary();

create or replace function public.sync_arkline_qc_return_shortage_summary()
returns trigger
language plpgsql
as $$
declare
  target_item_id uuid;
begin
  if tg_op = 'UPDATE' and old.arkline_po_item_id is distinct from new.arkline_po_item_id then
    perform public.refresh_arkline_po_item_actual_qty(old.arkline_po_item_id);
  end if;

  target_item_id = case
    when tg_op = 'DELETE' then old.arkline_po_item_id
    else new.arkline_po_item_id
  end;

  perform public.refresh_arkline_po_item_actual_qty(target_item_id);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists arkline_qc_return_batches_sync_shortage on public.arkline_qc_return_batches;
create trigger arkline_qc_return_batches_sync_shortage
after insert or update or delete on public.arkline_qc_return_batches
for each row execute function public.sync_arkline_qc_return_shortage_summary();

create or replace function public.set_arkline_qc_return_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists arkline_qc_return_batches_set_updated_at on public.arkline_qc_return_batches;
create trigger arkline_qc_return_batches_set_updated_at
before update on public.arkline_qc_return_batches
for each row execute function public.set_arkline_qc_return_updated_at();

alter table public.arkline_qc_return_batches enable row level security;
alter table public.arkline_qc_return_batch_lines enable row level security;

grant select, insert, update, delete on public.arkline_qc_return_batches to authenticated;
grant select, insert, update, delete on public.arkline_qc_return_batch_lines to authenticated;
grant usage, select on sequence public.arkline_qc_return_number_seq to authenticated;
grant execute on function public.create_arkline_qc_return_batch(text, uuid, text, text, text, uuid, integer, date, text, text, text, jsonb) to authenticated;
grant execute on function public.record_arkline_rework_receipt(uuid, date, text, text, jsonb) to authenticated;
grant execute on function public.close_arkline_return_shortage(uuid, text, text) to authenticated;

drop policy if exists arkline_qc_return_batches_authenticated_all on public.arkline_qc_return_batches;
create policy arkline_qc_return_batches_authenticated_all
on public.arkline_qc_return_batches
for all
to authenticated
using (true)
with check (true);

drop policy if exists arkline_qc_return_batch_lines_authenticated_all on public.arkline_qc_return_batch_lines;
create policy arkline_qc_return_batch_lines_authenticated_all
on public.arkline_qc_return_batch_lines
for all
to authenticated
using (true)
with check (true);

insert into public.dir_user_permissions (code, label, description)
values
  ('qc.retur_report.add', 'Add Return Report', 'Create regular and Arkline return batches in Quality Control.'),
  ('qc.retur_report.edit', 'Edit Return Report', 'Record returned repair goods and update return progress in Quality Control.')
on conflict (code) do update
set label = excluded.label,
    description = excluded.description;

insert into public.dir_user_roles (role, permission_code)
values
  ('qc_coordinator', 'qc.retur_report.add'),
  ('qc_coordinator', 'qc.retur_report.edit'),
  ('qc_staff', 'qc.retur_report.add'),
  ('qc_staff', 'qc.retur_report.edit')
on conflict (role, permission_code) do nothing;

commit;
