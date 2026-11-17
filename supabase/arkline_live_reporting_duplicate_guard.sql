begin;

create or replace function public.arkline_live_reporting_reject_duplicate_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  duplicate_key text;
begin
  duplicate_key := concat_ws('|',
    new.session_date, new.start_time, new.end_date, new.end_time,
    new.sales_channel, new.session_type,
    coalesce(new.host_profile_id, new.host_display_name_snapshot, ''),
    new.incremental_amount
  );

  -- Serialize identical submissions, including ones targeting different live runs.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(duplicate_key, 0));

  if exists (
    select 1
    from public.arkline_live_reporting_sessions existing
    where existing.session_date = new.session_date
      and existing.start_time = new.start_time
      and existing.end_date = new.end_date
      and existing.end_time = new.end_time
      and existing.sales_channel = new.sales_channel
      and existing.session_type = new.session_type
      and existing.host_profile_id is not distinct from new.host_profile_id
      and (new.host_profile_id is not null
        or existing.host_display_name_snapshot is not distinct from new.host_display_name_snapshot)
      and existing.incremental_amount = new.incremental_amount
  ) then
    raise exception 'This live session has already been entered.' using errcode = '23505';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_arkline_live_reporting_reject_duplicate_session
  on public.arkline_live_reporting_sessions;

create trigger trg_arkline_live_reporting_reject_duplicate_session
before insert on public.arkline_live_reporting_sessions
for each row execute function public.arkline_live_reporting_reject_duplicate_session();

commit;
