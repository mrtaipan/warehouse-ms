begin;

create or replace function public.generate_hrga_reimbursement_claim_number()
returns text
language plpgsql
as $$
declare
  month_number int;
  month_roman text;
  year_text text;
  prefix_text text;
  next_number int;
begin
  month_number := extract(month from now());
  year_text := to_char(now(), 'YYYY');
  month_roman := case month_number
    when 1 then 'I'
    when 2 then 'II'
    when 3 then 'III'
    when 4 then 'IV'
    when 5 then 'V'
    when 6 then 'VI'
    when 7 then 'VII'
    when 8 then 'VIII'
    when 9 then 'IX'
    when 10 then 'X'
    when 11 then 'XI'
    when 12 then 'XII'
  end;

  prefix_text := 'RC-' || month_roman || year_text || '-';

  perform pg_advisory_xact_lock(hashtext(prefix_text));

  select coalesce(max(right(claim_number, 3)::int), 0) + 1
    into next_number
  from public.hrga_reimbursement_claims
  where claim_number like prefix_text || '%';

  return prefix_text || lpad(next_number::text, 3, '0');
end;
$$;

alter table if exists public.hrga_reimbursement_claims
  alter column claim_number set default public.generate_hrga_reimbursement_claim_number();

drop function if exists public.generate_arkline_reimbursement_claim_number();

commit;
