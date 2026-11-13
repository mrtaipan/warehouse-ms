begin;

alter table public.warehouse_loan_items
  drop constraint if exists warehouse_loan_items_event_type_check;
alter table public.warehouse_loan_items
  add constraint warehouse_loan_items_event_type_check check (event_type in (
    'REQUEST', 'EDIT_REQUEST', 'ISSUE', 'DECLARE_RETURN', 'RECEIVE', 'CLOSE',
    'QUEUE_STORED', 'CANCEL_REQUEST'
  ));

create or replace function public.update_warehouse_loan_request_item(
  p_item_id uuid, p_size text, p_qty integer
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item public.warehouse_loan_items%rowtype;
  v_loan public.warehouse_loans%rowtype;
  v_issued integer;
  v_cancelled integer;
  v_size text := nullif(btrim(coalesce(p_size, '')), '');
begin
  if (select auth.uid()) is null then raise exception 'Sign in to edit a loan item'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Qty must be positive'; end if;

  select * into v_item from public.warehouse_loan_items
    where id = p_item_id and event_type = 'REQUEST' for update;
  if not found then raise exception 'Loan item not found'; end if;
  select * into v_loan from public.warehouse_loans where id = v_item.loan_id for update;
  if v_loan.requester_id <> (select auth.uid()) and not public.warehouse_loan_is_admin() then
    raise exception 'Only the borrower or admin can edit this item';
  end if;
  if v_loan.status <> 'REQUESTED' then raise exception 'This loan can no longer be edited'; end if;
  if v_loan.group_code = 'ARKLINE' and coalesce(upper(v_size), '') not in ('XS','S','M','L','XL','XXL') then
    raise exception 'Choose a valid Arkline size';
  end if;

  select coalesce(sum(qty) filter (where event_type = 'ISSUE'), 0),
    coalesce(sum(qty) filter (where event_type = 'CANCEL_REQUEST'), 0)
  into v_issued, v_cancelled from public.warehouse_loan_items
  where request_item_id = p_item_id;
  if p_qty < v_issued + v_cancelled then
    raise exception 'Qty cannot be below the already issued or cancelled quantity';
  end if;
  if v_issued > 0 and v_size is distinct from v_item.size then
    raise exception 'Size cannot change after this item has been issued';
  end if;
  if v_size is not distinct from v_item.size and p_qty = v_item.qty then return; end if;

  update public.warehouse_loan_items set size = v_size, qty = p_qty where id = p_item_id;
  insert into public.warehouse_loan_items(
    loan_id, request_item_id, event_type, sku_id, item_name, size, qty, notes, actor_id, actor_email
  ) values (
    v_item.loan_id, p_item_id, 'EDIT_REQUEST', v_item.sku_id, v_item.item_name,
    v_size, p_qty,
    jsonb_build_object('previous_size', v_item.size, 'previous_qty', v_item.qty)::text,
    (select auth.uid()), coalesce(auth.jwt()->>'email', '')
  );
  perform public.warehouse_loan_refresh_status(v_item.loan_id);
end;
$$;

revoke all on function public.update_warehouse_loan_request_item(uuid,text,integer) from public, anon;
grant execute on function public.update_warehouse_loan_request_item(uuid,text,integer) to authenticated;

commit;
