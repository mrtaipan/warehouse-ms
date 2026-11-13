create table if not exists public.warehouse_loan_number_counters (
  year_number integer primary key,
  last_number bigint not null check (last_number > 0)
);
revoke all on public.warehouse_loan_number_counters from anon, authenticated;

alter table public.warehouse_loans add column if not exists loan_number text;
create unique index if not exists warehouse_loans_number_key on public.warehouse_loans (loan_number);

with numbered as (
  select id, extract(year from created_at at time zone 'Asia/Jakarta')::integer as year_number,
    row_number() over (partition by extract(year from created_at at time zone 'Asia/Jakarta') order by created_at, id) as sequence_number,
    created_at at time zone 'Asia/Jakarta' as local_created_at, group_code
  from public.warehouse_loans where loan_number is null
)
update public.warehouse_loans loan set loan_number =
  left(numbered.group_code, 1) || 'L' || numbered.sequence_number || '-'
  || to_char(numbered.local_created_at, 'DD')
  || (array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[extract(month from numbered.local_created_at)::integer]
  || to_char(numbered.local_created_at, 'YY')
from numbered where loan.id = numbered.id;

insert into public.warehouse_loan_number_counters (year_number, last_number)
select extract(year from created_at at time zone 'Asia/Jakarta')::integer,
  max(substring(loan_number from '^[AMO]L([0-9]+)-')::bigint)
from public.warehouse_loans where loan_number is not null
group by 1
on conflict (year_number) do update set last_number = greatest(public.warehouse_loan_number_counters.last_number, excluded.last_number);

create or replace function public.warehouse_loan_assign_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_local timestamp; v_year integer; v_sequence bigint;
begin
  if new.loan_number is not null then return new; end if;
  v_local := coalesce(new.created_at, now()) at time zone 'Asia/Jakarta';
  v_year := extract(year from v_local)::integer;
  insert into public.warehouse_loan_number_counters (year_number, last_number)
  values (v_year, 1)
  on conflict (year_number) do update set last_number = public.warehouse_loan_number_counters.last_number + 1
  returning last_number into v_sequence;
  new.loan_number := left(new.group_code, 1) || 'L' || v_sequence || '-'
    || to_char(v_local, 'DD')
    || (array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'])[extract(month from v_local)::integer]
    || to_char(v_local, 'YY');
  return new;
end;
$$;
revoke all on function public.warehouse_loan_assign_number() from public, anon, authenticated;
drop trigger if exists warehouse_loan_assign_number on public.warehouse_loans;
create trigger warehouse_loan_assign_number before insert on public.warehouse_loans
for each row execute function public.warehouse_loan_assign_number();

alter table public.warehouse_loans alter column loan_number set not null;
