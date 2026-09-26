begin;

-- One run represents one continuous live stream. A new run resets the GMV baseline.
create table if not exists public.arkline_live_reporting_runs (
  id bigint generated always as identity primary key,
  sales_channel text not null default 'TIKTOK',
  status text not null default 'ACTIVE',
  started_by_profile_id text references public.dir_user_profiles(id) on delete set null,
  started_by_display_name_snapshot text,
  current_gross_amount numeric(18,2) not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint arkline_live_reporting_runs_channel_check check (sales_channel in ('TIKTOK', 'SHOPEE')),
  constraint arkline_live_reporting_runs_status_check check (status in ('ACTIVE', 'ENDED')),
  constraint arkline_live_reporting_runs_amount_check check (current_gross_amount >= 0)
);

alter table public.arkline_live_reporting_sessions
  add column if not exists live_run_id bigint references public.arkline_live_reporting_runs(id) on delete set null,
  add column if not exists checkpoint_no integer,
  add column if not exists end_date date,
  add column if not exists previous_gross_amount numeric(18,2) not null default 0,
  add column if not exists incremental_amount numeric(18,2) not null default 0;

update public.arkline_live_reporting_sessions
set end_date = case
  when end_time <= start_time then session_date + 1
  else session_date
end
where end_date is null
   or (end_date = session_date and end_time <= start_time);

alter table public.arkline_live_reporting_sessions
  alter column end_date set not null;

alter table public.arkline_live_reporting_sessions
  drop constraint if exists arkline_live_reporting_sessions_time_check;

alter table public.arkline_live_reporting_sessions
  add constraint arkline_live_reporting_sessions_time_check
  check (
    (end_date = session_date and end_time > start_time)
    or
    (end_date = session_date + 1 and end_time <= start_time)
  );

-- Existing entries were already treated as independent sessions. Preserve that behavior
-- by using their stored gross amount as their incremental amount.
update public.arkline_live_reporting_sessions
set incremental_amount = gross_amount
where incremental_amount = 0
  and gross_amount > 0;

-- Keep this migration runnable even when the original live-reporting SQL was
-- applied without its helper functions.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.live_reporting_current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.live_reporting_is_admin()
returns boolean
language sql
stable
as $$
  select public.live_reporting_current_user_email() = 'mr.peneliti@gmail.com';
$$;

create or replace function public.live_reporting_current_profile_id()
returns text
language sql
stable
as $$
  select profile.id
  from public.dir_user_profiles profile
  where lower(coalesce(profile.email, '')) = public.live_reporting_current_user_email()
  limit 1;
$$;

create or replace function public.live_reporting_has_permission(target_code text)
returns boolean
language sql
stable
as $$
  select
    public.live_reporting_is_admin()
    or exists (
      select 1
      from public.dir_user_profiles profile
      join public.dir_user_roles role_map
        on role_map.role = profile.role
      where lower(coalesce(profile.email, '')) = public.live_reporting_current_user_email()
        and role_map.permission_code = target_code
    );
$$;

create index if not exists idx_arkline_live_reporting_runs_status
  on public.arkline_live_reporting_runs (status, sales_channel, started_at desc);

create index if not exists idx_arkline_live_reporting_sessions_run
  on public.arkline_live_reporting_sessions (live_run_id, checkpoint_no desc, created_at desc);

drop trigger if exists trg_arkline_live_reporting_runs_updated_at on public.arkline_live_reporting_runs;
create trigger trg_arkline_live_reporting_runs_updated_at
before update on public.arkline_live_reporting_runs
for each row execute function public.set_updated_at();

alter table public.arkline_live_reporting_runs enable row level security;

drop policy if exists "authenticated_select_arkline_live_reporting_runs" on public.arkline_live_reporting_runs;
drop policy if exists "authenticated_insert_arkline_live_reporting_runs" on public.arkline_live_reporting_runs;
drop policy if exists "authenticated_update_arkline_live_reporting_runs" on public.arkline_live_reporting_runs;

create policy "authenticated_select_arkline_live_reporting_runs"
on public.arkline_live_reporting_runs for select to authenticated
using (
  public.live_reporting_has_permission('arkline.financial_management.live_reporting.view')
);

create policy "authenticated_insert_arkline_live_reporting_runs"
on public.arkline_live_reporting_runs for insert to authenticated
with check (
  public.live_reporting_has_permission('arkline.financial_management.live_reporting.add')
  and started_by_profile_id = public.live_reporting_current_profile_id()
);

create policy "authenticated_update_arkline_live_reporting_runs"
on public.arkline_live_reporting_runs for update to authenticated
using (
  public.live_reporting_is_admin()
  or public.live_reporting_has_permission('arkline.financial_management.live_reporting.edit')
  or started_by_profile_id = public.live_reporting_current_profile_id()
)
with check (
  public.live_reporting_is_admin()
  or public.live_reporting_has_permission('arkline.financial_management.live_reporting.edit')
  or started_by_profile_id = public.live_reporting_current_profile_id()
);

-- Atomic checkpoint creation prevents two users from calculating the same increment.
create or replace function public.arkline_live_reporting_add_checkpoint(
  p_start_new boolean,
  p_live_run_id bigint,
  p_session_date date,
  p_start_time time,
  p_end_time time,
  p_session_type text,
  p_sales_channel text,
  p_host_profile_id text,
  p_host_display_name_snapshot text,
  p_partner_profile_id text,
  p_partner_display_name_snapshot text,
  p_wearing_product_sku text,
  p_partner_wearing_product_sku text,
  p_gross_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id bigint;
  v_previous_amount numeric(18,2) := 0;
  v_incremental_amount numeric(18,2);
  v_checkpoint_no integer;
  v_session_id bigint;
  v_end_date date;
  v_latest_end_at timestamp;
  v_checkpoint_start_at timestamp;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.live_reporting_has_permission('arkline.financial_management.live_reporting.add') then
    raise exception 'You do not have permission to submit live reporting';
  end if;

  if p_host_profile_id is null or p_host_profile_id <> public.live_reporting_current_profile_id() then
    raise exception 'Live reporting can only be submitted for the signed-in host';
  end if;

  if p_session_type not in ('STANDALONE', 'PAIRING') then
    raise exception 'Invalid session type';
  end if;

  if p_sales_channel not in ('TIKTOK', 'SHOPEE') then
    raise exception 'Invalid sales channel';
  end if;

  if p_gross_amount is null or p_gross_amount <= 0 then
    raise exception 'Gross amount must be above zero';
  end if;

  if p_session_type = 'PAIRING' and p_partner_profile_id is null then
    raise exception 'Pairing requires a partner';
  end if;

  v_end_date := case
    when p_end_time <= p_start_time then p_session_date + 1
    else p_session_date
  end;

  v_checkpoint_start_at := p_session_date + p_start_time;

  if p_start_new then
    update public.arkline_live_reporting_runs
    set status = 'ENDED',
        ended_at = now(),
        updated_at = now()
    where status = 'ACTIVE'
      and sales_channel = p_sales_channel;

    insert into public.arkline_live_reporting_runs (
      sales_channel,
      started_by_profile_id,
      started_by_display_name_snapshot,
      current_gross_amount
    )
    values (
      p_sales_channel,
      p_host_profile_id,
      p_host_display_name_snapshot,
      0
    )
    returning id into v_run_id;
  else
    if p_live_run_id is null then
      raise exception 'Select the current live run to continue';
    end if;

    select id, current_gross_amount
      into v_run_id, v_previous_amount
    from public.arkline_live_reporting_runs
    where id = p_live_run_id
      and status = 'ACTIVE'
      and sales_channel = p_sales_channel
    for update;

    if v_run_id is null then
      raise exception 'The selected live run is no longer active';
    end if;
  end if;

  if p_start_new then
    v_previous_amount := 0;
  else
    select session_row.end_date + session_row.end_time
      into v_latest_end_at
    from public.arkline_live_reporting_sessions session_row
    where session_row.live_run_id = v_run_id
    order by session_row.checkpoint_no desc nulls last, session_row.created_at desc
    limit 1;

    if v_latest_end_at is not null and v_checkpoint_start_at < v_latest_end_at then
      raise exception 'Session start must be at or after the previous checkpoint end time (%)',
        to_char(v_latest_end_at, 'DD Mon YYYY HH24:MI');
    end if;
  end if;

  if p_gross_amount < v_previous_amount then
    raise exception 'GMV must be greater than or equal to the previous checkpoint';
  end if;

  v_incremental_amount := p_gross_amount - v_previous_amount;

  select coalesce(max(checkpoint_no), 0) + 1
    into v_checkpoint_no
  from public.arkline_live_reporting_sessions
  where live_run_id = v_run_id;

  insert into public.arkline_live_reporting_sessions (
    live_run_id,
    checkpoint_no,
    session_date,
    end_date,
    start_time,
    end_time,
    session_type,
    sales_channel,
    host_profile_id,
    host_display_name_snapshot,
    partner_profile_id,
    partner_display_name_snapshot,
    wearing_product_sku,
    partner_wearing_product_sku,
    gross_amount,
    previous_gross_amount,
    incremental_amount
  )
  values (
    v_run_id,
    v_checkpoint_no,
    p_session_date,
    v_end_date,
    p_start_time,
    p_end_time,
    p_session_type,
    p_sales_channel,
    p_host_profile_id,
    p_host_display_name_snapshot,
    case when p_session_type = 'PAIRING' then p_partner_profile_id else null end,
    case when p_session_type = 'PAIRING' then p_partner_display_name_snapshot else null end,
    p_wearing_product_sku,
    case when p_session_type = 'PAIRING' then p_partner_wearing_product_sku else null end,
    p_gross_amount,
    v_previous_amount,
    v_incremental_amount
  )
  returning id into v_session_id;

  update public.arkline_live_reporting_runs
  set current_gross_amount = p_gross_amount,
      updated_at = now()
  where id = v_run_id;

  insert into public.arkline_live_reporting_credits (
    session_id,
    host_profile_id,
    host_display_name_snapshot,
    credited_amount
  )
  values (
    v_session_id,
    p_host_profile_id,
    p_host_display_name_snapshot,
    case when p_session_type = 'PAIRING' then v_incremental_amount / 2 else v_incremental_amount end
  );

  if p_session_type = 'PAIRING' then
    insert into public.arkline_live_reporting_credits (
      session_id,
      host_profile_id,
      host_display_name_snapshot,
      credited_amount
    )
    values (
      v_session_id,
      p_partner_profile_id,
      p_partner_display_name_snapshot,
      v_incremental_amount / 2
    );
  end if;

  return jsonb_build_object(
    'session_id', v_session_id,
    'live_run_id', v_run_id,
    'checkpoint_no', v_checkpoint_no,
    'end_date', v_end_date,
    'previous_gross_amount', v_previous_amount,
    'incremental_amount', v_incremental_amount
  );
end;
$$;

revoke all on function public.arkline_live_reporting_add_checkpoint(
  boolean, bigint, date, time, time, text, text, text, text, text, text, text, text, numeric
) from public;
grant execute on function public.arkline_live_reporting_add_checkpoint(
  boolean, bigint, date, time, time, text, text, text, text, text, text, text, text, numeric
) to authenticated;

commit;
