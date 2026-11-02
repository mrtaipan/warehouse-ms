-- Apply in Supabase SQL Editor after arkline_live_reporting_runs.sql.
-- Existing sessions are unchanged; only new inserts are validated.
create or replace function public.arkline_live_reporting_validate_time_window()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  local_now timestamp := now() at time zone 'Asia/Jakarta';
  session_start timestamp;
  session_end timestamp;
begin
  session_start := new.session_date + new.start_time;
  session_end := (case
    when new.end_time <= new.start_time then new.session_date + 1
    else new.session_date
  end) + new.end_time;

  if session_start > local_now or session_end > local_now then
    raise exception 'The session cannot be in the future.';
  end if;
  if session_start < local_now - interval '24 hours' then
    raise exception 'The session must start within the last 24 hours.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_arkline_live_reporting_time_window
  on public.arkline_live_reporting_sessions;

create trigger trg_arkline_live_reporting_time_window
before insert on public.arkline_live_reporting_sessions
for each row execute function public.arkline_live_reporting_validate_time_window();
