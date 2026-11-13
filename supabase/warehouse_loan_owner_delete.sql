create or replace function public.warehouse_loan_is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select lower(coalesce(auth.jwt()->>'email', '')) = 'mr.peneliti@gmail.com'
    or exists (
      select 1 from public.dir_user_profiles profile
      where (profile.authenticated_id = (select auth.uid()) or profile.id = (select auth.uid())::text)
        and lower(profile.role) = 'admin'
    );
$$;
revoke all on function public.warehouse_loan_is_admin() from public, anon, authenticated;

create or replace function public.delete_warehouse_loan(p_loan_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_loan public.warehouse_loans%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to delete a loan'; end if;
  select * into v_loan from public.warehouse_loans where id = p_loan_id for update;
  if not found then raise exception 'Loan not found'; end if;
  if v_loan.requester_id <> (select auth.uid()) and not public.warehouse_loan_is_admin() then
    raise exception 'Only the borrower or admin can delete this loan'; end if;
  if v_loan.status not in ('REQUESTED', 'CANCELLED') or exists (
    select 1 from public.warehouse_loan_items where loan_id = p_loan_id and event_type = 'ISSUE'
  ) then raise exception 'Issued loans cannot be deleted'; end if;
  delete from public.warehouse_loan_items where loan_id = p_loan_id and event_type <> 'REQUEST';
  delete from public.warehouse_loan_items where loan_id = p_loan_id;
  delete from public.warehouse_loans where id = p_loan_id;
end;
$$;
revoke all on function public.delete_warehouse_loan(uuid) from public, anon;
grant execute on function public.delete_warehouse_loan(uuid) to authenticated;

create or replace function public.delete_warehouse_loan_request_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item public.warehouse_loan_items%rowtype; v_loan public.warehouse_loans%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Sign in to remove a loan item'; end if;
  select * into v_item from public.warehouse_loan_items where id = p_item_id and event_type = 'REQUEST' for update;
  if not found then raise exception 'Loan item not found'; end if;
  select * into v_loan from public.warehouse_loans where id = v_item.loan_id for update;
  if v_loan.requester_id <> (select auth.uid()) and not public.warehouse_loan_is_admin() then
    raise exception 'Only the borrower or admin can remove an item'; end if;
  if exists (select 1 from public.warehouse_loan_items where request_item_id = p_item_id and event_type = 'ISSUE') then
    raise exception 'Issued loan items cannot be removed'; end if;
  delete from public.warehouse_loan_items where request_item_id = p_item_id;
  delete from public.warehouse_loan_items where id = p_item_id;
  if not exists (select 1 from public.warehouse_loan_items where loan_id = v_loan.id and event_type = 'REQUEST') then
    delete from public.warehouse_loans where id = v_loan.id;
  else
    perform public.warehouse_loan_refresh_status(v_loan.id);
  end if;
end;
$$;
revoke all on function public.delete_warehouse_loan_request_item(uuid) from public, anon;
grant execute on function public.delete_warehouse_loan_request_item(uuid) to authenticated;

create or replace function public.warehouse_loan_prevent_self_issue()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type = 'ISSUE' and exists (
    select 1 from public.warehouse_loans loan
    where loan.id = new.loan_id and loan.requester_id = (select auth.uid())
      and not public.warehouse_loan_is_admin()
  ) then raise exception 'The borrower cannot issue their own loan'; end if;
  return new;
end;
$$;
revoke all on function public.warehouse_loan_prevent_self_issue() from public, anon, authenticated;
drop trigger if exists warehouse_loan_prevent_self_issue on public.warehouse_loan_items;
create trigger warehouse_loan_prevent_self_issue
before insert on public.warehouse_loan_items
for each row execute function public.warehouse_loan_prevent_self_issue();
