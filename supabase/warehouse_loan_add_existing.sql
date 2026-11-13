create or replace function public.warehouse_loan_refresh_status(p_loan_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_issued integer; v_requested integer; v_resolved integer; v_declared integer; v_closed integer; v_cancelled integer;
begin
  select
    coalesce(sum(qty) filter (where event_type = 'REQUEST'), 0),
    coalesce(sum(qty) filter (where event_type = 'ISSUE'), 0),
    coalesce(sum(qty) filter (where event_type in ('RECEIVE', 'CLOSE')), 0),
    coalesce(sum(qty) filter (where event_type = 'DECLARE_RETURN'), 0),
    coalesce(sum(qty) filter (where event_type = 'CLOSE'), 0),
    coalesce(sum(qty) filter (where event_type = 'CANCEL_REQUEST'), 0)
  into v_requested, v_issued, v_resolved, v_declared, v_closed, v_cancelled
  from public.warehouse_loan_items where loan_id = p_loan_id;

  update public.warehouse_loans set status = case
    when v_requested > 0 and v_cancelled = v_requested and v_issued = 0 then 'CANCELLED'
    when v_issued + v_cancelled >= v_requested and v_resolved >= v_issued and v_closed > 0 then 'CLOSED'
    when v_issued > 0 and v_issued + v_cancelled >= v_requested and v_resolved >= v_issued then 'COMPLETED'
    when v_declared > (select coalesce(sum(qty), 0) from public.warehouse_loan_items
      where loan_id = p_loan_id and event_type = 'RECEIVE') then 'RETURN_PENDING'
    when v_issued > 0 and v_issued + v_cancelled >= v_requested then 'IN_LOAN'
    else 'REQUESTED' end,
    updated_at = now()
  where id = p_loan_id;
end;
$$;
revoke all on function public.warehouse_loan_refresh_status(uuid) from public, anon, authenticated;

create or replace function public.add_warehouse_loan_items(p_loan_id uuid, p_items jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_loan public.warehouse_loans%rowtype;
  v_item jsonb;
  v_existing_count integer;
  v_requested integer;
  v_issued integer;
  v_cancelled integer;
  v_email text := coalesce(auth.jwt()->>'email', '');
begin
  if (select auth.uid()) is null then raise exception 'Sign in to add loan items'; end if;
  if coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Add 1 to 50 products';
  end if;

  select * into v_loan from public.warehouse_loans where id = p_loan_id for update;
  if not found then raise exception 'Loan not found'; end if;
  if v_loan.requester_id <> (select auth.uid()) and not public.warehouse_loan_is_admin() then
    raise exception 'Only the borrower or admin can add items to this loan';
  end if;
  if v_loan.status <> 'REQUESTED' then raise exception 'This loan can no longer accept items'; end if;

  select count(*) filter (where event_type = 'REQUEST'),
    coalesce(sum(qty) filter (where event_type = 'REQUEST'), 0),
    coalesce(sum(qty) filter (where event_type = 'ISSUE'), 0),
    coalesce(sum(qty) filter (where event_type = 'CANCEL_REQUEST'), 0)
  into v_existing_count, v_requested, v_issued, v_cancelled
  from public.warehouse_loan_items where loan_id = p_loan_id;
  if v_existing_count + jsonb_array_length(p_items) > 50 then
    raise exception 'A loan can contain at most 50 products';
  end if;
  if v_issued + v_cancelled >= v_requested then
    raise exception 'All requested items are already issued or cancelled';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if btrim(coalesce(v_item->>'sku', '')) = '' or btrim(coalesce(v_item->>'name', '')) = ''
      or coalesce((v_item->>'qty')::integer, 0) <= 0 then
      raise exception 'Each product needs SKU, name, and positive qty';
    end if;
    if v_loan.group_code = 'ARKLINE' and not exists (
      select 1 from public.arkline_dir_products p where p.is_active
        and upper(btrim(p.sku_induk)) = upper(btrim(v_item->>'sku'))
    ) then raise exception 'Arkline SKU not found: %', v_item->>'sku'; end if;
    insert into public.warehouse_loan_items(loan_id, event_type, sku_id, item_name, size, qty, actor_id, actor_email)
    values(v_loan.id, 'REQUEST', upper(btrim(v_item->>'sku')), btrim(v_item->>'name'),
      nullif(btrim(v_item->>'size'), ''), (v_item->>'qty')::integer, (select auth.uid()), v_email);
  end loop;

  perform public.warehouse_loan_refresh_status(v_loan.id);
  return v_loan.id;
end;
$$;
revoke all on function public.add_warehouse_loan_items(uuid,jsonb) from public, anon;
grant execute on function public.add_warehouse_loan_items(uuid,jsonb) to authenticated;

do $$
declare v_loan_id uuid;
begin
  for v_loan_id in select id from public.warehouse_loans loop
    perform public.warehouse_loan_refresh_status(v_loan_id);
  end loop;
end;
$$;
