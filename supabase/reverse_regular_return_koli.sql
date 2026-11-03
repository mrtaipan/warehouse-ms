create table if not exists public.warehouse_return_koli_reversals (
  id bigint generated always as identity primary key,
  inbound_id bigint not null,
  koli_sequence integer not null,
  reversed_rows jsonb not null,
  reversed_by text,
  reversed_at timestamptz not null default now()
);

alter table public.warehouse_return_koli_reversals enable row level security;
grant select on public.warehouse_return_koli_reversals to authenticated;
create policy warehouse_return_koli_reversals_read on public.warehouse_return_koli_reversals
  for select to authenticated using (public.reqc_has_permission('qc.retur_report.edit'));

create or replace function public.reverse_regular_return_koli(
  p_inbound_id bigint, p_koli_sequence integer
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  target_rows jsonb;
  row_count integer;
  actor_email text;
begin
  if (select auth.uid()) is null or not public.reqc_has_permission('qc.retur_report.edit') then
    raise exception 'Not authorized to reverse return koli';
  end if;
  if p_inbound_id is null or p_koli_sequence is null or p_koli_sequence < 1 then
    raise exception 'Choose a valid GRN and koli';
  end if;

  perform 1 from public.warehouse_returns
  where inbound_id = p_inbound_id and koli_sequence = p_koli_sequence
  for update;

  select count(*), jsonb_agg(to_jsonb(row_data) order by row_data.id)
  into row_count, target_rows
  from public.warehouse_returns row_data
  where row_data.inbound_id = p_inbound_id and row_data.koli_sequence = p_koli_sequence;

  if row_count = 0 then raise exception 'Return koli no longer exists'; end if;
  if exists (
    select 1 from public.warehouse_returns
    where inbound_id = p_inbound_id and koli_sequence = p_koli_sequence
      and lower(coalesce(status, 'waiting')) <> 'waiting'
  ) then
    raise exception 'Only Waiting return koli can be reversed';
  end if;

  actor_email := (select email from auth.users where id = (select auth.uid()));
  insert into public.warehouse_return_koli_reversals(inbound_id, koli_sequence, reversed_rows, reversed_by)
  values (p_inbound_id, p_koli_sequence, target_rows, actor_email);

  delete from public.warehouse_returns
  where inbound_id = p_inbound_id and koli_sequence = p_koli_sequence
    and lower(coalesce(source_phase, '')) = 'qc';

  update public.warehouse_returns
  set koli_sequence = null, updated_at = now()
  where inbound_id = p_inbound_id and koli_sequence = p_koli_sequence;

  return row_count;
end;
$$;

revoke execute on function public.reverse_regular_return_koli(bigint, integer) from public, anon;
grant execute on function public.reverse_regular_return_koli(bigint, integer) to authenticated;
