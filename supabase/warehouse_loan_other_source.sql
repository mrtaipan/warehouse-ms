alter table public.warehouse_loan_items
  drop constraint if exists warehouse_loan_items_source_type_check;

alter table public.warehouse_loan_items
  add constraint warehouse_loan_items_source_type_check
  check (source_type in ('STORAGE', 'PL_QUEUE', 'OTHER'));

create or replace function public.issue_warehouse_loan_item_other(
  p_item_id uuid, p_qty integer, p_source_label text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_request public.warehouse_loan_items%rowtype;
  v_loan public.warehouse_loans%rowtype;
  v_issued integer;
  v_cancelled integer;
  v_id uuid;
  v_source_label text := btrim(coalesce(p_source_label, ''));
begin
  if (select auth.uid()) is null or not public.warehouse_loan_can_manage() then
    raise exception 'Not allowed to issue loans';
  end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Qty must be positive'; end if;
  if v_source_label = '' or char_length(v_source_label) > 160 then
    raise exception 'Enter a source location (maximum 160 characters)';
  end if;

  select * into v_request from public.warehouse_loan_items
  where id = p_item_id and event_type = 'REQUEST' for update;
  if not found then raise exception 'Loan item not found'; end if;
  select * into v_loan from public.warehouse_loans where id = v_request.loan_id for update;
  select coalesce(sum(qty) filter (where event_type = 'ISSUE'), 0),
    coalesce(sum(qty) filter (where event_type = 'CANCEL_REQUEST'), 0)
  into v_issued, v_cancelled from public.warehouse_loan_items
  where request_item_id = p_item_id;
  if v_issued + v_cancelled + p_qty > v_request.qty then
    raise exception 'Qty exceeds requested amount';
  end if;

  insert into public.warehouse_loan_items (
    loan_id, request_item_id, event_type, sku_id, item_name, size,
    category_id, brand_code, qty, source_type, source_label, actor_id, actor_email
  ) values (
    v_loan.id, p_item_id, 'ISSUE', v_request.sku_id, v_request.item_name, v_request.size,
    v_request.category_id, v_request.brand_code, p_qty, 'OTHER', v_source_label,
    (select auth.uid()), coalesce(auth.jwt()->>'email', '')
  ) returning id into v_id;

  perform public.warehouse_loan_refresh_status(v_loan.id);
  return v_id;
end;
$$;

revoke all on function public.issue_warehouse_loan_item_other(uuid,integer,text) from public, anon;
grant execute on function public.issue_warehouse_loan_item_other(uuid,integer,text) to authenticated;
