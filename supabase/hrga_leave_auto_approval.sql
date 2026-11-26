-- Run once in the Supabase SQL Editor.
-- Pending leave requests are auto-approved at 00:10 Asia/Jakarta on the day
-- after their end date. Weekends and registered public holidays are excluded
-- from leave_used, and admin profiles are exempt from balance deduction.

create index if not exists hrga_leave_requests_submitted_end_date_idx
  on public.hrga_leave_requests (end_date, id)
  where status = 'SUBMITTED';

create or replace function public.hrga_set_leave_request_status(
  p_request_id bigint,
  p_next_status text
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_request record;
  v_profile record;
  v_working_days integer := 0;
begin
  if upper(coalesce(p_next_status, '')) not in ('APPROVED', 'REJECTED') then
    raise exception 'Invalid leave request status.';
  end if;

  select request.id,
         request.employee_authenticated_id,
         request.employee_email_snapshot,
         request.start_date,
         request.end_date,
         request.status
    into v_request
    from public.hrga_leave_requests as request
   where request.id = p_request_id
   for update;

  if not found then
    raise exception 'Leave request not found.';
  end if;

  if upper(coalesce(v_request.status, '')) <> 'SUBMITTED' then
    return false;
  end if;

  if upper(p_next_status) = 'APPROVED' then
    select profile.id, profile.role, profile.leave_used
      into v_profile
      from public.dir_user_profiles as profile
     where (
       v_request.employee_authenticated_id is not null
       and profile.authenticated_id = v_request.employee_authenticated_id
     ) or (
       nullif(trim(v_request.employee_email_snapshot), '') is not null
       and lower(coalesce(profile.email, '')) = lower(v_request.employee_email_snapshot)
     )
     order by case
       when v_request.employee_authenticated_id is not null
        and profile.authenticated_id = v_request.employee_authenticated_id then 0
       else 1
     end, profile.id
     limit 1
     for update of profile;

    if not found then
      raise exception 'Could not find the employee profile for this leave request.'
        using errcode = 'P0002';
    end if;

    select count(*)::integer
      into v_working_days
      from pg_catalog.generate_series(
        v_request.start_date::timestamp,
        v_request.end_date::timestamp,
        interval '1 day'
      ) as days(day_value)
     where extract(isodow from days.day_value) between 1 and 5
       and not exists (
         select 1
           from public.hrga_public_holidays as holiday
          where holiday.holiday_date = days.day_value::date
       );

    if lower(coalesce(v_profile.role, '')) <> 'admin' and v_working_days > 0 then
      update public.dir_user_profiles
         set leave_used = coalesce(v_profile.leave_used, 0) + v_working_days
       where id = v_profile.id;
    end if;
  end if;

  update public.hrga_leave_requests
     set status = upper(p_next_status),
         approved_at = clock_timestamp(),
         approved_by = coalesce(auth.uid()::text, 'AUTO')
   where id = p_request_id;

  return true;
end;
$$;

revoke all on function public.hrga_set_leave_request_status(bigint, text)
  from public, anon;
grant execute on function public.hrga_set_leave_request_status(bigint, text)
  to authenticated, postgres;

create or replace function public.auto_approve_overdue_hrga_leave_requests()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_id bigint;
  v_processed integer := 0;
begin
  for v_request_id in
    select request.id
      from public.hrga_leave_requests as request
     where upper(coalesce(request.status, '')) = 'SUBMITTED'
       and request.end_date < (now() at time zone 'Asia/Jakarta')::date
     order by request.end_date, request.id
     for update skip locked
  loop
    begin
      if public.hrga_set_leave_request_status(v_request_id, 'APPROVED') then
        v_processed := v_processed + 1;
      end if;
    exception when no_data_found then
      raise warning 'Skipped overdue leave request %: employee profile was not found.', v_request_id;
    end;
  end loop;

  return v_processed;
end;
$$;

revoke all on function public.auto_approve_overdue_hrga_leave_requests()
  from public, anon, authenticated;
grant execute on function public.auto_approve_overdue_hrga_leave_requests()
  to postgres;

create extension if not exists pg_cron with schema extensions;

do $$
declare
  existing_job record;
begin
  if current_setting('cron.timezone', true) not in ('GMT', 'UTC') then
    raise exception 'Expected pg_cron timezone GMT/UTC; check cron.timezone before scheduling the 00:10 WIB job';
  end if;

  for existing_job in
    select jobid from cron.job
     where jobname = 'hrga-auto-approve-overdue-leaves-0010-wib'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'hrga-auto-approve-overdue-leaves-0010-wib',
  '10 17 * * *',
  $job$select public.auto_approve_overdue_hrga_leave_requests();$job$
);

-- Catch up requests that were already overdue when this script is installed.
select public.auto_approve_overdue_hrga_leave_requests();

notify pgrst, 'reload schema';
