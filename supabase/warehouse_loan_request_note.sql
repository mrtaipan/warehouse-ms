-- Run after warehouse_loan_purposes.sql. Keep the original three-argument
-- function available for clients that have not yet updated.
alter table public.warehouse_loans
  add column if not exists request_note text;

create or replace function public.create_warehouse_loan(
  p_group text, p_purpose text, p_items jsonb, p_request_note text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_loan_id uuid;
  v_note text := nullif(btrim(coalesce(p_request_note, '')), '');
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to request a loan' using errcode = '42501';
  end if;
  if char_length(v_note) > 2000 then
    raise exception 'Loan note must be 2000 characters or fewer';
  end if;

  v_loan_id := public.create_warehouse_loan(p_group, p_purpose, p_items);
  update public.warehouse_loans
  set request_note = v_note
  where id = v_loan_id and requester_id = (select auth.uid());
  if not found then
    raise exception 'Could not save the loan note';
  end if;
  return v_loan_id;
end;
$$;

revoke all on function public.create_warehouse_loan(text,text,jsonb,text) from public, anon;
grant execute on function public.create_warehouse_loan(text,text,jsonb,text) to authenticated;
