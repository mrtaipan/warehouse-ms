begin;

create or replace function public.live_reporting_can_delete_session()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.live_reporting_is_admin()
    or exists (
      select 1
      from public.dir_user_profiles profile
      where lower(coalesce(profile.email, '')) = public.live_reporting_current_user_email()
        and profile.role = 'hrga'
    );
$$;

revoke all on function public.live_reporting_can_delete_session() from public, anon;
grant execute on function public.live_reporting_can_delete_session() to authenticated;

create or replace function public.arkline_live_reporting_before_delete_session()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  latest_session_id bigint;
  previous_session_id bigint;
  previous_gross_amount numeric(18,2);
begin
  if not public.live_reporting_can_delete_session() then
    raise exception 'Only an admin or HRGA can delete live sessions';
  end if;

  if old.live_run_id is not null then
    perform 1 from public.arkline_live_reporting_runs
    where id = old.live_run_id for update;

    select id into latest_session_id
    from public.arkline_live_reporting_sessions
    where live_run_id = old.live_run_id
    order by checkpoint_no desc nulls last, id desc
    limit 1;

    if latest_session_id is distinct from old.id then
      raise exception 'Only the latest checkpoint in a live can be deleted';
    end if;

    select id, gross_amount into previous_session_id, previous_gross_amount
    from public.arkline_live_reporting_sessions
    where live_run_id = old.live_run_id and id <> old.id
    order by checkpoint_no desc nulls last, id desc
    limit 1;

    update public.arkline_live_reporting_runs
    set current_gross_amount = coalesce(previous_gross_amount, 0),
        status = case when previous_session_id is null then 'ENDED' else status end,
        ended_at = case when previous_session_id is null then coalesce(ended_at, now()) else ended_at end
    where id = old.live_run_id;
  end if;

  return old;
end;
$$;

drop policy if exists "authenticated_delete_arkline_live_reporting_sessions"
  on public.arkline_live_reporting_sessions;
create policy "authenticated_delete_arkline_live_reporting_sessions"
on public.arkline_live_reporting_sessions for delete to authenticated
using (public.live_reporting_can_delete_session());

drop policy if exists "authenticated_delete_arkline_live_reporting_credits"
  on public.arkline_live_reporting_credits;
create policy "authenticated_delete_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for delete to authenticated
using (public.live_reporting_can_delete_session());

revoke delete on public.arkline_live_reporting_sessions, public.arkline_live_reporting_credits from anon;
grant delete on public.arkline_live_reporting_sessions, public.arkline_live_reporting_credits to authenticated;

commit;
