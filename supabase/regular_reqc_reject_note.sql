-- Require a real reject note when reviewing Reguler Re-QC Grade B/C.
create or replace function public.confirm_reqc_reject_to_storage_with_note(
  p_result_id uuid,
  p_koli_number text,
  p_reject_note text,
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
  reject_note_value text;
begin
  if not public.reqc_has_permission('qc.confirmation.edit') then
    raise exception 'Not authorized to verify Re-QC results';
  end if;

  reject_note_value := nullif(trim(coalesce(p_reject_note, '')), '');
  if reject_note_value is null then
    raise exception 'Enter a reject note before storing Grade B/C';
  end if;

  select * into result_row
  from public.reqc_results
  where id = p_result_id
  for update;
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
  elsif target_koli !~ '^R-[0-9]+$' or not exists (
    select 1 from public.warehouse_reject_storage
    where koli_number = target_koli and status = 'DRAFT'
  ) then
    raise exception 'Choose an unposted R-koli or leave blank for a new koli';
  end if;

  insert into public.warehouse_reject_storage (
    koli_number, product_name, size, category_id, sub_category_id, item_type_id,
    qty, grade, reject_note, status, created_by, updated_by, reqc_result_id
  ) values (
    target_koli, queue_row.item_name, coalesce(queue_row.size, 'UNKNOWN'),
    category_root_id, sub_category_id, item_type_id, result_row.qty,
    result_row.grade, reject_note_value, 'DRAFT', p_confirmed_by,
    p_confirmed_by, result_row.id
  ) returning id into storage_id;

  update public.reqc_results
  set status = 'REJECTION_STORAGE', reviewed_by = p_confirmed_by,
      reviewed_at = now(), updated_at = now()
  where id = result_row.id;

  return storage_id;
end;
$$;

revoke execute on function public.confirm_reqc_reject_to_storage(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.confirm_reqc_reject_to_storage_with_note(uuid, text, text, text) from public, anon;
grant execute on function public.confirm_reqc_reject_to_storage_with_note(uuid, text, text, text) to authenticated;
