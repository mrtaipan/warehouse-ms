-- Re-QC workflow for regular goods already held in warehouse storage.

create table if not exists public.reqc_queue (
  id uuid primary key default gen_random_uuid(),
  source_warehouse_storage_id bigint null references public.warehouse_storage(id) on delete set null,
  source_location_label text null,
  source_pl_packing_item_id bigint null,
  sku_id text null,
  source_variant_code text null,
  item_name text not null,
  size text null,
  brand_code text null,
  category_id bigint null references public.dir_categories(id) on delete set null,
  group_code text not null default 'MOB',
  qty integer not null check (qty > 0),
  status text not null default 'WAITING_QC'
    check (status in ('WAITING_QC', 'IN_PROGRESS', 'QC_DONE', 'CANCELLED')),
  notes text null,
  created_at timestamptz not null default now(),
  created_by text null,
  updated_at timestamptz not null default now()
);

create index if not exists reqc_queue_status_created_idx
  on public.reqc_queue (status, created_at desc);
create index if not exists reqc_queue_source_storage_idx
  on public.reqc_queue (source_warehouse_storage_id);

alter table public.qc_items
  add column if not exists qc_type text not null default 'INITIAL',
  add column if not exists reqc_queue_id uuid null references public.reqc_queue(id) on delete restrict;

alter table public.qc_items
  drop constraint if exists qc_items_qc_type_check;
alter table public.qc_items
  add constraint qc_items_qc_type_check check (qc_type in ('INITIAL', 'RE_QC'));

create index if not exists qc_items_reqc_queue_idx
  on public.qc_items (reqc_queue_id, status)
  where reqc_queue_id is not null;


create table if not exists public.reqc_results (
  id uuid primary key default gen_random_uuid(),
  reqc_queue_id uuid not null references public.reqc_queue(id) on delete restrict,
  qc_item_id bigint not null references public.qc_items(id) on delete restrict,
  grade text not null check (grade in ('A', 'B', 'C')),
  qty integer not null check (qty > 0),
  status text not null default 'PENDING_REVIEW'
    check (status in ('PENDING_REVIEW', 'SHELVING_QUEUE', 'REJECTION_STORAGE')),
  reviewed_by text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (qc_item_id, grade)
);

create index if not exists reqc_results_review_idx
  on public.reqc_results (status, grade, created_at desc);
create index if not exists reqc_results_queue_idx
  on public.reqc_results (reqc_queue_id, grade);

alter table public.warehouse_shelving_queue
  add column if not exists reqc_result_id uuid null
    references public.reqc_results(id) on delete restrict;
create unique index if not exists warehouse_shelving_queue_reqc_result_uidx
  on public.warehouse_shelving_queue (reqc_result_id)
  where reqc_result_id is not null;


alter table public.warehouse_reject_storage
  add column if not exists reqc_result_id uuid null
    references public.reqc_results(id) on delete restrict;
create unique index if not exists warehouse_reject_storage_reqc_result_uidx
  on public.warehouse_reject_storage (reqc_result_id)
  where reqc_result_id is not null;

alter table public.warehouse_storage_movements
  add column if not exists reqc_queue_id uuid null
    references public.reqc_queue(id) on delete restrict;

alter table public.warehouse_storage_movements
  drop constraint if exists warehouse_storage_movements_type_check;
alter table public.warehouse_storage_movements
  add constraint warehouse_storage_movements_type_check check (movement_type in (
    'STORE_QUEUE', 'MOVE', 'TAKE_OUT', 'TEMPORARY_IN', 'TEMPORARY_RETURN',
    'TEMPORARY_ADJUSTMENT_IN', 'TEMPORARY_ADJUSTMENT_OUT', 'PUTAWAY_IN',
    'CUSTOMER_RETURN_IN', 'CUSTOMER_REPLACEMENT_OUT', 'QC_RECHECK_OUT'
  ));

alter table public.reqc_queue enable row level security;
alter table public.reqc_results enable row level security;
grant select, insert, update on public.reqc_queue, public.reqc_results to authenticated;

create or replace function public.reqc_has_permission(p_code text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.dir_user_profiles profile
    where profile.authenticated_id = auth.uid()
      and (
        lower(profile.role) = 'admin'
        or exists (
          select 1 from public.dir_user_roles role_permission
          where role_permission.role = profile.role
            and role_permission.permission_code = p_code
        )
      )
  );
$$;

revoke execute on function public.reqc_has_permission(text) from public, anon;
grant execute on function public.reqc_has_permission(text) to authenticated;

drop policy if exists reqc_queue_authenticated_select on public.reqc_queue;
create policy reqc_queue_authenticated_select on public.reqc_queue
  for select to authenticated using (true);
drop policy if exists reqc_queue_authenticated_insert on public.reqc_queue;
create policy reqc_queue_authenticated_insert on public.reqc_queue
  for insert to authenticated with check (public.reqc_has_permission('storage.location.edit'));
drop policy if exists reqc_queue_authenticated_update on public.reqc_queue;
create policy reqc_queue_authenticated_update on public.reqc_queue
  for update to authenticated
  using (public.reqc_has_permission('qc.receiving.add') or public.reqc_has_permission('qc.grading_task.edit'))
  with check (public.reqc_has_permission('qc.receiving.add') or public.reqc_has_permission('qc.grading_task.edit'));
drop policy if exists reqc_results_authenticated_select on public.reqc_results;
create policy reqc_results_authenticated_select on public.reqc_results
  for select to authenticated using (true);
drop policy if exists reqc_results_authenticated_insert on public.reqc_results;
create policy reqc_results_authenticated_insert on public.reqc_results
  for insert to authenticated with check (public.reqc_has_permission('qc.grading_task.edit'));
drop policy if exists reqc_results_authenticated_update on public.reqc_results;
create policy reqc_results_authenticated_update on public.reqc_results
  for update to authenticated
  using (public.reqc_has_permission('qc.confirmation.edit') or (status = 'PENDING_REVIEW' and public.reqc_has_permission('qc.grading_task.edit')))
  with check (public.reqc_has_permission('qc.confirmation.edit') or (status = 'PENDING_REVIEW' and public.reqc_has_permission('qc.grading_task.edit')));

create or replace function public.move_warehouse_storage_to_reqc_queue(
  p_warehouse_storage_id bigint,
  p_qty integer,
  p_created_by text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_row public.warehouse_storage%rowtype;
  location_name text;
  queue_id uuid;
begin
  if not public.reqc_has_permission('storage.location.edit') then
    raise exception 'Not authorized to move stock to Re-QC';
  end if;
  if coalesce(p_qty, 0) <= 0 then
    raise exception 'Re-QC qty must be greater than zero';
  end if;

  select * into source_row
  from public.warehouse_storage
  where id = p_warehouse_storage_id
    and is_active = true
  for update;

  if source_row.id is null then
    raise exception 'Warehouse stock row was not found or is inactive';
  end if;
  if source_row.category_id is null then
    raise exception 'Set the item category before moving it to Re-QC';
  end if;
  if exists (
    select 1 from public.dir_rack_locations location_row
    where location_row.id = source_row.rack_location_id
      and upper(coalesce(location_row.group_code, '')) = 'ARKLINE'
  ) then
    raise exception 'Arkline stock cannot enter Re-QC Reguler';
  end if;
  if p_qty > floor(source_row.qty)::integer then
    raise exception 'Re-QC qty exceeds available warehouse stock (%)', source_row.qty;
  end if;

  select rl.location_name into location_name
  from public.dir_rack_locations rl
  where rl.id = source_row.rack_location_id;

  insert into public.reqc_queue (
    source_warehouse_storage_id, source_location_label, source_pl_packing_item_id,
    sku_id, source_variant_code, item_name, size, brand_code, category_id,
    group_code, qty, created_by
  ) values (
    source_row.id, location_name, source_row.source_pl_packing_item_id,
    source_row.sku_id, source_row.source_variant_code, source_row.item_name,
    source_row.size, source_row.brand_code, source_row.category_id,
    coalesce((select upper(nullif(trim(rl.group_code), '')) from public.dir_rack_locations rl where rl.id = source_row.rack_location_id), 'MOB'),
    p_qty, nullif(trim(coalesce(p_created_by, '')), '')
  ) returning id into queue_id;

  insert into public.warehouse_storage_movements (
    warehouse_storage_id, movement_type, qty, from_location_label,
    to_location_label, item_name, size, sku_id, created_by, reqc_queue_id
  ) values (
    source_row.id, 'QC_RECHECK_OUT', p_qty, location_name,
    'Re-QC Queue', source_row.item_name, source_row.size,
    coalesce(source_row.sku_id, source_row.source_variant_code), p_created_by, queue_id
  );

  if source_row.qty = p_qty then
    delete from public.warehouse_storage where id = source_row.id;
  else
    update public.warehouse_storage
    set qty = qty - p_qty,
        updated_at = now(),
        updated_by = p_created_by
    where id = source_row.id;
  end if;

  return queue_id;
end;
$$;

revoke execute on function public.move_warehouse_storage_to_reqc_queue(bigint, integer, text) from public, anon;
grant execute on function public.move_warehouse_storage_to_reqc_queue(bigint, integer, text) to authenticated;

create or replace function public.create_reqc_qc_task(
  p_reqc_queue_id uuid,
  p_assigned_to text,
  p_qty integer
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  queue_row public.reqc_queue%rowtype;
  existing_allocated_qty integer;
  task_id bigint;
begin
  if not public.reqc_has_permission('qc.receiving.add') then
    raise exception 'Not authorized to allocate Re-QC';
  end if;
  if nullif(trim(coalesce(p_assigned_to, '')), '') is null or coalesce(p_qty, 0) <= 0 then
    raise exception 'Choose an inspector and a positive allocation qty';
  end if;

  select * into queue_row
  from public.reqc_queue
  where id = p_reqc_queue_id and status <> 'CANCELLED'
  for update;
  if queue_row.id is null then
    raise exception 'Re-QC queue item was not found';
  end if;

  select coalesce(sum(task.allocated_qty), 0)::integer into existing_allocated_qty
  from public.qc_items task where task.reqc_queue_id = queue_row.id;
  if existing_allocated_qty + p_qty > queue_row.qty then
    raise exception 'Allocation exceeds remaining Re-QC qty (%)', queue_row.qty - existing_allocated_qty;
  end if;

  insert into public.qc_items (
    inbound_id, inbound_unload_id, assigned_to, allocated_qty, expected_qty,
    is_confirmed, status, qty_a, qty_b, qty_c, stopwatch_seconds,
    model_name, photo_url, qty_in, locked_qty, variant_name,
    product_model_id, product_model_variant_id, model_replaced, qc_type, reqc_queue_id
  ) values (
    null, null, lower(trim(p_assigned_to)), p_qty, queue_row.qty,
    true, 'queued', 0, 0, 0, 0,
    queue_row.item_name, null, queue_row.qty, 0, queue_row.source_variant_code,
    null, null, false, 'RE_QC', queue_row.id
  ) returning id into task_id;

  return task_id;
end;
$$;

revoke execute on function public.create_reqc_qc_task(uuid, text, integer) from public, anon;
grant execute on function public.create_reqc_qc_task(uuid, text, integer) to authenticated;

create or replace function public.sync_reqc_results_from_qc_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.qc_type <> 'RE_QC' or new.reqc_queue_id is null then
    return new;
  end if;

  if new.status = 'done' then
    insert into public.reqc_results (reqc_queue_id, qc_item_id, grade, qty)
    select new.reqc_queue_id, new.id, grade_row.grade, grade_row.qty
    from (values ('A', new.qty_a), ('B', new.qty_b), ('C', new.qty_c)) as grade_row(grade, qty)
    where grade_row.qty > 0
    on conflict (qc_item_id, grade) do update
      set qty = excluded.qty, updated_at = now()
      where public.reqc_results.status = 'PENDING_REVIEW';
  end if;

  update public.reqc_queue queue_row
  set status = case
        when coalesce((select sum(task.allocated_qty) from public.qc_items task where task.reqc_queue_id = queue_row.id), 0) >= queue_row.qty
         and not exists (select 1 from public.qc_items task where task.reqc_queue_id = queue_row.id and task.status <> 'done')
          then 'QC_DONE'
        when exists (select 1 from public.qc_items task where task.reqc_queue_id = queue_row.id)
          then 'IN_PROGRESS'
        else 'WAITING_QC'
      end,
      updated_at = now()
  where queue_row.id = new.reqc_queue_id;

  return new;
end;
$$;

drop trigger if exists qc_items_sync_reqc_results on public.qc_items;
create trigger qc_items_sync_reqc_results
after insert or update of status, qty_a, qty_b, qty_c, allocated_qty
on public.qc_items
for each row execute function public.sync_reqc_results_from_qc_item();

create or replace function public.confirm_reqc_grade_a_to_shelving(
  p_result_id uuid,
  p_confirmed_by text default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result_row public.reqc_results%rowtype;
  queue_row public.reqc_queue%rowtype;
  shelving_id bigint;
begin
  if not public.reqc_has_permission('qc.confirmation.edit') then
    raise exception 'Not authorized to verify Re-QC results';
  end if;
  select * into result_row
  from public.reqc_results
  where id = p_result_id
  for update;
  if result_row.id is null or result_row.grade <> 'A' then
    raise exception 'Only a Re-QC Grade A result can be confirmed to shelving';
  end if;
  if result_row.status <> 'PENDING_REVIEW' then
    raise exception 'Re-QC result has already been reviewed';
  end if;

  select * into queue_row from public.reqc_queue where id = result_row.reqc_queue_id;
  insert into public.warehouse_shelving_queue (
    source_storage_id, source_location_label, source_pl_packing_item_id,
    sku_id, source_variant_code, item_name, size, group_code, qty,
    status, notes, created_by, reqc_result_id
  ) values (
    queue_row.source_warehouse_storage_id, queue_row.source_location_label,
    queue_row.source_pl_packing_item_id, queue_row.sku_id,
    queue_row.source_variant_code, queue_row.item_name, queue_row.size,
    queue_row.group_code, result_row.qty, 'WAITING_SHELVING',
    'Confirmed Re-QC Grade A', nullif(trim(coalesce(p_confirmed_by, '')), ''), result_row.id
  ) returning id into shelving_id;

  update public.reqc_results
  set status = 'SHELVING_QUEUE', reviewed_by = p_confirmed_by,
      reviewed_at = now(), updated_at = now()
  where id = result_row.id;

  return shelving_id;
end;
$$;

revoke execute on function public.confirm_reqc_grade_a_to_shelving(uuid, text) from public, anon;
grant execute on function public.confirm_reqc_grade_a_to_shelving(uuid, text) to authenticated;

create or replace function public.confirm_reqc_reject_to_storage(
  p_result_id uuid,
  p_koli_number text default null,
  p_confirmed_by text default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  result_row public.reqc_results%rowtype;
  queue_row public.reqc_queue%rowtype;
  category_root_id bigint;
  sub_category_id bigint;
  item_type_id bigint;
  storage_id bigint;
  target_koli text;
begin
  if not public.reqc_has_permission('qc.confirmation.edit') then
    raise exception 'Not authorized to verify Re-QC results';
  end if;
  select * into result_row from public.reqc_results where id = p_result_id for update;
  if result_row.id is null or result_row.grade not in ('B', 'C') then
    raise exception 'Only Re-QC Grade B or C can be routed to rejection storage';
  end if;
  if result_row.status <> 'PENDING_REVIEW' then
    raise exception 'Re-QC result has already been reviewed';
  end if;

  select * into queue_row from public.reqc_queue where id = result_row.reqc_queue_id;
  with recursive category_path as (
    select category.id, category.parent_id, category.level
    from public.dir_categories category
    where category.id = queue_row.category_id
    union all
    select parent.id, parent.parent_id, parent.level
    from public.dir_categories parent
    join category_path child on child.parent_id = parent.id
  )
  select
    max(id) filter (where level = 1),
    max(id) filter (where level = 2),
    max(id) filter (where level = 3)
  into category_root_id, sub_category_id, item_type_id
  from category_path;

  if category_root_id is null or sub_category_id is null then
    raise exception 'Product category path is incomplete; cannot create rejection storage entry';
  end if;

  target_koli := nullif(trim(coalesce(p_koli_number, '')), '');
  if target_koli is null then
    target_koli := public.next_warehouse_reject_koli_number();
  elsif not exists (
    select 1 from public.warehouse_reject_storage
    where koli_number = target_koli and status = 'DRAFT'
  ) then
    raise exception 'Choose an existing draft reject-storage koli or leave blank for a new koli';
  end if;

  insert into public.warehouse_reject_storage (
    koli_number, product_name, size, category_id, sub_category_id, item_type_id,
    qty, grade, reject_note, status, created_by, updated_by, reqc_result_id
  ) values (
    target_koli, queue_row.item_name, coalesce(queue_row.size, 'UNKNOWN'),
    category_root_id, sub_category_id, item_type_id, result_row.qty,
    result_row.grade, 'RE-QC result', 'DRAFT', p_confirmed_by,
    p_confirmed_by, result_row.id
  ) returning id into storage_id;

  update public.reqc_results
  set status = 'REJECTION_STORAGE', reviewed_by = p_confirmed_by,
      reviewed_at = now(), updated_at = now()
  where id = result_row.id;

  return storage_id;
end;
$$;

revoke execute on function public.confirm_reqc_reject_to_storage(uuid, text, text) from public, anon;
grant execute on function public.confirm_reqc_reject_to_storage(uuid, text, text) to authenticated;

create or replace function public.move_warehouse_storage_selection_to_reqc_queue(
  p_items jsonb,
  p_created_by text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item record;
  item_count integer;
  strict_unique_count integer;
begin
  if not public.reqc_has_permission('storage.location.edit') then
    raise exception 'Not authorized to move stock to Re-QC';
  end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' then
    raise exception 'Select at least one stock item';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Select at least one stock item';
  end if;

  select count(*), count(distinct warehouse_storage_id)
  into item_count, strict_unique_count
  from jsonb_to_recordset(p_items) as selected(warehouse_storage_id bigint, qty integer);

  if item_count <> strict_unique_count or item_count > 100 then
    raise exception 'Choose up to 100 distinct stock rows';
  end if;

  for item in
    select warehouse_storage_id, qty
    from jsonb_to_recordset(p_items) as selected(warehouse_storage_id bigint, qty integer)
    order by warehouse_storage_id
  loop
    perform public.move_warehouse_storage_to_reqc_queue(item.warehouse_storage_id, item.qty, p_created_by);
  end loop;

  return item_count;
end;
$$;

revoke execute on function public.move_warehouse_storage_selection_to_reqc_queue(jsonb, text) from public, anon;
grant execute on function public.move_warehouse_storage_selection_to_reqc_queue(jsonb, text) to authenticated;
