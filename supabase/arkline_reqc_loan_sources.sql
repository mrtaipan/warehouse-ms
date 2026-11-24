create or replace function public.list_arkline_reqc_loan_sources()
returns table (loan_id uuid, loan_number text, queue_ids uuid[])
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (
    public.reqc_has_permission('qc.receiving.view')
    or public.reqc_has_permission('qc.summary.view')
  ) then
    raise exception 'Not allowed to view Arkline Re-QC loans';
  end if;

  return query
  select loan.id, loan.loan_number, array_agg(queue.id order by queue.created_at, queue.id)
  from public.reqc_queue queue
  join public.warehouse_loan_items receipt on receipt.id = queue.source_loan_receive_id
  join public.warehouse_loans loan on loan.id = receipt.loan_id
  where queue.group_code = 'ARKLINE'
    and queue.status <> 'CANCELLED'
  group by loan.id, loan.loan_number
  order by loan.loan_number desc;
end;
$$;

revoke all on function public.list_arkline_reqc_loan_sources() from public, anon;
grant execute on function public.list_arkline_reqc_loan_sources() to authenticated;
