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
