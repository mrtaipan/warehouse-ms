begin;

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
  if not public.live_reporting_is_admin() then
    raise exception 'Only an admin can delete live sessions';
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

drop trigger if exists trg_arkline_live_reporting_before_delete_session
  on public.arkline_live_reporting_sessions;
create trigger trg_arkline_live_reporting_before_delete_session
before delete on public.arkline_live_reporting_sessions
for each row execute function public.arkline_live_reporting_before_delete_session();

drop policy if exists "authenticated_delete_arkline_live_reporting_sessions"
  on public.arkline_live_reporting_sessions;
create policy "authenticated_delete_arkline_live_reporting_sessions"
on public.arkline_live_reporting_sessions for delete to authenticated
using (public.live_reporting_is_admin());

drop policy if exists "authenticated_delete_arkline_live_reporting_credits"
  on public.arkline_live_reporting_credits;
create policy "authenticated_delete_arkline_live_reporting_credits"
on public.arkline_live_reporting_credits for delete to authenticated
using (public.live_reporting_is_admin());

commit;
