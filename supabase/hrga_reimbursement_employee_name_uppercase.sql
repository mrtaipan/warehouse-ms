begin;

update public.hrga_reimbursement_claims
set employee_name_snapshot = upper(trim(employee_name_snapshot))
where employee_name_snapshot is not null
  and employee_name_snapshot <> upper(trim(employee_name_snapshot));

commit;
