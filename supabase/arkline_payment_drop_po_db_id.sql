-- Apply after deploying the app version that no longer reads or writes po_db_id.
begin;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'arkline_payment'
      and column_name = 'po_db_id'
  ) then
    if exists (select 1 from public.arkline_payment where po_db_id is not null) then
      raise exception 'arkline_payment.po_db_id contains data; review it before dropping the column';
    end if;
  end if;
end
$$;

alter table public.arkline_payment drop column if exists po_db_id;

commit;
